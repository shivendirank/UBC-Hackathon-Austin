"""Read-side logic shared by the REST API and the MCP server."""

from __future__ import annotations

import json
import re
import time
from typing import Optional

from . import config, db
from .receipts import explorer_url, make_snapshot, pin_snapshot

def book_status(score: dict) -> str:
    """One-word status for the list. Letter grade stays in the payload for receipts."""
    if score.get("mid_c") is None:
        return "Empty"
    if score.get("exhausted"):
        return "Runs out"
    return "OK"


def money_to_move(score: dict) -> str | None:
    """Dollar figure for a 10¢ move, or None when there is no two-sided book."""
    if score.get("mid_c") is None:
        return None
    cost = float(score.get("move_cost_usd") or 0)
    return f"${cost:,.2f}" if cost < 100 else f"${cost:,.0f}"


def book_sentence(score: dict) -> str:
    """Short line for badge / detail headline. Not a paragraph."""
    status = book_status(score)
    money = money_to_move(score)
    if money is None:
        return "Empty"
    if status == "Runs out":
        return f"Runs out · {money}"
    return f"{money} to move 10¢"


def _row_to_market(row) -> dict:
    score = json.loads(row["score_json"])
    return {
        "symbol": row["symbol"],
        "event_title": row["event_title"],
        "event_slug": row["event_slug"],
        "label": row["label"],
        "category": row["category"],
        "grade": row["grade"],
        "status": book_status(score),
        "grade_words": book_sentence(score),
        "odds_pct": score["mid_c"],
        "move_cost_usd": row["move_cost_usd"],
        "spread_c": row["spread_c"],
        "updated_at": row["ts"],
        "score": score,
        "event_ticker": row["event_ticker"],
        "synthetic": str(row["symbol"]).startswith("SYNTHETIC-"),
    }


def list_markets(conn, category: Optional[str] = None, sort: str = "fragile", limit: int = 100) -> list[dict]:
    sql = db.LATEST_GRADES_SQL
    args: list = []
    if category:
        sql += " WHERE c.category = ?"
        args.append(category)
    # Empty (one-sided) books sort last so the list is not a wall of dashes.
    empty_last = "(g.best_bid_c IS NULL OR g.best_ask_c IS NULL) ASC, "
    cost = "g.move_cost_usd ASC" if sort == "fragile" else "g.move_cost_usd DESC"
    sql += " ORDER BY " + empty_last + cost + " LIMIT ?"
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
    from .liquidity import book_report, resilience

    snap_row = conn.execute("SELECT bids_json, asks_json FROM snapshots WHERE id=?", (row["snapshot_id"],)).fetchone()
    liquidity = book_report(json.loads(snap_row["bids_json"]), json.loads(snap_row["asks_json"])) if snap_row else None
    related = [dict(r) for r in conn.execute(
        "SELECT id, kind, verified FROM relations WHERE members_json LIKE ?", (f'%"{symbol}"%',)).fetchall()]
    out = _row_to_market(row)
    out.update(liquidity=liquidity, resilience=resilience(history), relations=related,
               history=history, receipts=receipts, alerts=alerts,
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
    from .receipts import ReceiptMinter, assessment_from_score, rescore

    latest = latest_snapshot(conn, symbol)
    if not latest:
        raise LookupError(symbol)
    snap = latest["snapshot"]
    h, _ = pin_snapshot(snap)
    uri = f"{config.SNAPSHOT_BASE_URI}/{h}.json"[:100]
    score = rescore(snap)  # grade exactly what we pinned
    onchain: dict = {}
    if config.ODDS_RECEIPT_PROGRAM_ID and config.RECEIPT_AUTHORITY_KEYPAIR:
        onchain = ReceiptMinter().mint(assessment_from_score(score), h, uri)
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


def mint_consistency(conn, relation_id: str, reason: str = "incident") -> dict:
    """Pin the latest books for a relation, re-run the check on exactly those books, and record it."""
    from . import incidents
    from .receipts import (ReceiptMinter, assessment_from_check, make_consistency_snapshot,
                           recheck_snapshot)

    rel = next((r for r in incidents.relations(conn) if r.id == relation_id), None)
    if not rel:
        raise LookupError(relation_id)
    raw = {}
    for s in rel.members:
        row = conn.execute("SELECT ts, bids_json, asks_json FROM snapshots WHERE symbol=? ORDER BY id DESC LIMIT 1",
                           (s,)).fetchone()
        if row:
            raw[s] = {"ts": row["ts"], "bids": json.loads(row["bids_json"]), "asks": json.loads(row["asks_json"])}
    snap = make_consistency_snapshot(rel.to_dict(), raw, int(time.time()),
                                     config.FEE_CENTS_PER_CONTRACT, config.SYNC_TOLERANCE_S)
    result = recheck_snapshot(snap)
    h, _ = pin_snapshot(snap)
    uri = f"{config.SNAPSHOT_BASE_URI}/{h}.json"[:100]
    a = assessment_from_check(result)
    onchain: dict = {}
    if config.ODDS_RECEIPT_PROGRAM_ID and config.RECEIPT_AUTHORITY_KEYPAIR:
        onchain = ReceiptMinter().mint(a, h, uri)
    with db.tx(conn):
        conn.execute(
            "INSERT INTO receipts(symbol, ts, grade, snapshot_hash, uri, tx_sig, receipt_pda, reason) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (a.subject, a.ts, "ABCDF"[a.grade], h, uri, onchain.get("tx_sig"), onchain.get("receipt_pda"), reason))
    out = {"subject": a.subject, "status": result["status"], "flags": a.flags, "snapshot_hash": h, "uri": uri,
           **onchain}
    if onchain.get("tx_sig"):
        out["explorer_url"] = explorer_url("tx", onchain["tx_sig"])
    return out
