"""Read-side logic shared by the REST API and the MCP server."""

from __future__ import annotations

import json
import re
import time
from typing import Optional

from . import config, db
from .receipts import explorer_url, make_snapshot, pin_snapshot

GRADE_WORDS = {
    "A": "Deep market. Moving these odds 10 cents would take $10,000 or more.",
    "B": "Solid. It would take thousands of dollars to move these odds 10 cents.",
    "C": "Fair. Around $1,000 could move these odds 10 cents.",
    "D": "Thin. A few hundred dollars could move these odds 10 cents.",
    "F": "Thin ice. Under $100 could move these odds, or the book is nearly empty.",
}


def _row_to_market(row) -> dict:
    score = json.loads(row["score_json"])
    return {
        "symbol": row["symbol"],
        "event_title": row["event_title"],
        "event_slug": row["event_slug"],
        "label": row["label"],
        "category": row["category"],
        "grade": row["grade"],
        "grade_words": GRADE_WORDS[row["grade"]],
        "odds_pct": score["mid_c"],
        "move_cost_usd": row["move_cost_usd"],
        "spread_c": row["spread_c"],
        "updated_at": row["ts"],
        "score": score,
    }


def list_markets(conn, category: Optional[str] = None, sort: str = "fragile", limit: int = 100) -> list[dict]:
    sql = db.LATEST_GRADES_SQL
    args: list = []
    if category:
        sql += " WHERE c.category = ?"
        args.append(category)
    sql += " ORDER BY g.move_cost_usd " + ("ASC" if sort == "fragile" else "DESC") + " LIMIT ?"
    args.append(limit)
    return [_row_to_market(r) for r in conn.execute(sql, args).fetchall()]


def get_market(conn, symbol: str, history_hours: int = 72) -> Optional[dict]:
    row = conn.execute(db.LATEST_GRADES_SQL + " WHERE g.symbol = ?", (symbol,)).fetchone()
    if not row:
        return None
    since = int(time.time()) - history_hours * 3600
    history = [dict(r) for r in conn.execute(
        "SELECT ts, grade, move_cost_usd, spread_c, best_bid_c, best_ask_c FROM grades "
        "WHERE symbol=? AND ts>=? ORDER BY ts", (symbol, since)).fetchall()]
    receipts = [dict(r) for r in conn.execute(
        "SELECT * FROM receipts WHERE symbol=? ORDER BY ts DESC LIMIT 20", (symbol,)).fetchall()]
    for r in receipts:
        if r.get("tx_sig"):
            r["explorer_url"] = explorer_url("tx", r["tx_sig"])
    alerts = [dict(r, detail=json.loads(r["detail_json"])) for r in conn.execute(
        "SELECT id, symbol, ts, kind, detail_json FROM alerts WHERE symbol=? ORDER BY ts DESC LIMIT 20",
        (symbol,)).fetchall()]
    snap = conn.execute("SELECT snapshot_hash FROM snapshots WHERE id=?", (row["snapshot_id"],)).fetchone()
    out = _row_to_market(row)
    out.update(history=history, receipts=receipts, alerts=alerts,
               snapshot_hash=snap["snapshot_hash"] if snap else None)
    return out


_SLUG_RE = re.compile(r"gemini\.com/(?:[\w-]+/)*prediction-markets/([\w-]+)", re.I)
_WORD_RE = re.compile(r"[a-z0-9]+")


def find_market(conn, query: str) -> Optional[str]:
    """Resolve a Gemini URL, instrument symbol, or free text ("will the rock win 2028") to a symbol.

    Free text picks the contract whose event title + label share the most words with the query;
    for an event with several contracts, the favorite wins ties. Good enough for a demo;
    Grok Bot does the heavier lifting of reading the post.
    """
    q = query.strip()
    hit = conn.execute("SELECT symbol FROM contracts WHERE symbol = ? COLLATE NOCASE", (q,)).fetchone()
    if hit:
        return hit["symbol"]
    m = _SLUG_RE.search(q)
    if m:
        rows = conn.execute(db.LATEST_GRADES_SQL + " WHERE c.event_slug = ? ORDER BY g.best_bid_c DESC",
                            (m.group(1),)).fetchall()
        if rows:
            return rows[0]["symbol"]
    words = set(_WORD_RE.findall(q.lower())) - {"the", "will", "a", "of", "in", "to", "be", "win", "odds", "check"}
    if not words:
        return None
    best, best_key = None, (0, -1)
    for r in conn.execute(db.LATEST_GRADES_SQL).fetchall():
        text = set(_WORD_RE.findall(f"{r['event_title']} {r['label']} {r['event_ticker']}".lower()))
        key = (len(words & text), r["best_bid_c"] or 0)
        if key[0] and key > best_key:
            best, best_key = r["symbol"], key
    return best


def latest_snapshot(conn, symbol: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT s.*, g.score_json FROM grades g JOIN snapshots s ON s.id = g.snapshot_id "
        "WHERE g.symbol=? ORDER BY g.id DESC LIMIT 1", (symbol,)).fetchone()
    if not row:
        return None
    score = json.loads(row["score_json"])
    c = conn.execute("SELECT quantity_minimum FROM contracts WHERE symbol=?", (symbol,)).fetchone()
    book = {"bids": json.loads(row["bids_json"]), "asks": json.loads(row["asks_json"])}
    snap = make_snapshot(symbol, row["ts"], book, score.get("last_trade_ts"),
                         c["quantity_minimum"] if c else 1.0)
    return {"snapshot": snap, "score": score}


def mint_receipt(conn, symbol: str, reason: str = "on_demand") -> dict:
    """Pin the latest snapshot and record it on Solana (if configured; otherwise pin only)."""
    from .receipts import ReceiptMinter, rescore

    latest = latest_snapshot(conn, symbol)
    if not latest:
        raise LookupError(symbol)
    snap = latest["snapshot"]
    h, _ = pin_snapshot(snap)
    uri = f"{config.SNAPSHOT_BASE_URI}/{h}.json"[:100]
    score = rescore(snap)  # grade exactly what we pinned
    onchain: dict = {}
    if config.ODDS_RECEIPT_PROGRAM_ID and config.RECEIPT_AUTHORITY_KEYPAIR:
        onchain = ReceiptMinter().mint(score, h, uri)
    with db.tx(conn):
        conn.execute(
            "INSERT INTO receipts(symbol, ts, grade, snapshot_hash, uri, tx_sig, receipt_pda, reason) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (symbol, score.ts, score.grade, h, uri, onchain.get("tx_sig"), onchain.get("receipt_pda"), reason))
    out = {"symbol": symbol, "grade": score.grade, "snapshot_hash": h, "uri": uri, **onchain}
    if onchain.get("tx_sig"):
        out["explorer_url"] = explorer_url("tx", onchain["tx_sig"])
    else:
        out["note"] = "Pinned only: set ODDS_RECEIPT_PROGRAM_ID and RECEIPT_AUTHORITY_KEYPAIR to record onchain."
    return out
