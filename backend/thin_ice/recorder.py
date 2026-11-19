"""Recorder: discover open Gemini contracts, roll through their books, store snapshots and grades.

    python -m thin_ice.recorder              # run forever (leave it running from Monday on)
    python -m thin_ice.recorder --once -n 20 # one pass over 20 contracts, then exit

At ~1 request/s and 2 requests per contract (book + trades), a 200-contract watchlist
refreshes about every 7 minutes. Demo markets get 1-second updates from ws.py instead.
"""

from __future__ import annotations

import argparse
import logging
import time

from . import config, db, incidents
from .consistency import suggest_relations
from .gemini import Gemini, open_contracts
from .receipts import make_snapshot, snapshot_hash
from .scoring import score_book, unusual_move

log = logging.getLogger("thin_ice.recorder")


# A BTC ladder has dozens of strikes. Cap each event and each category, then
# round-robin, so sports and commodities are recorded alongside crypto.
# Sports listings lead with player props. Skip those and keep scanning until
# game markets (spreads, moneylines) fill the sports bucket.
PER_EVENT = 2
PER_CATEGORY = 16
EVENTS_PER_CATEGORY = 12
SPORTS_SCAN = 80
SPORTS_EVENTS = 12
SPORTS_CAP = 24


def _headline(event: dict) -> bool:
    title = (event.get("title") or "").lower()
    return not any(piece in title for piece in ("player ", "top 10", "top 20", "top 5"))


def discover(client: Gemini, conn, limit: int) -> list[str]:
    """Refresh a spread of contracts and return a category-balanced watchlist."""
    now = int(time.time())
    events: list[dict] = []
    buckets: dict[str, list[str]] = {}
    with db.tx(conn):
        for category in config.CATEGORIES:
            bucket = buckets.setdefault(category, [])
            cap = SPORTS_CAP if category == "Sports" else PER_CATEGORY
            scan = SPORTS_SCAN if category == "Sports" else EVENTS_PER_CATEGORY
            kept = 0
            for event in client.events(category=category, max_events=scan):
                if category == "Sports" and not _headline(event):
                    continue
                events.append(event)
                opened = list(open_contracts(event))
                for contract in opened:
                    db.upsert_contract(conn, event, contract, now)
                kept += 1
                if len(bucket) < cap:
                    for contract in opened[:PER_EVENT]:
                        symbol = contract["instrumentSymbol"]
                        if symbol not in bucket:
                            bucket.append(symbol)
                        if len(bucket) >= cap:
                            break
                if category == "Sports" and kept >= SPORTS_EVENTS and len(bucket) >= cap:
                    break
                if category != "Sports" and kept >= EVENTS_PER_CATEGORY:
                    break
    rels = suggest_relations(events)
    incidents.sync_relations(conn, rels)
    mixed: list[str] = []
    rows = list(buckets.values())
    i = 0
    while len(mixed) < limit:
        added = False
        for bucket in rows:
            if i < len(bucket) and bucket[i] not in mixed:
                mixed.append(bucket[i])
                added = True
        if not added:
            break
        i += 1
    known = set(mixed)
    related = [s for r in incidents.relations(conn, verified_only=True) for s in r.members if s in known]
    ordered = list(dict.fromkeys(list(config.DEMO_SYMBOLS) + related + mixed))
    log.info("discovered %d open contracts across %d categories, watching %d",
             sum(len(b) for b in rows), len(rows), min(limit, len(ordered)))
    return ordered[:limit]


def record_one(client: Gemini, conn, symbol: str) -> dict:
    book = client.book(symbol)
    trades = client.trades(symbol)
    now = int(time.time())
    row = conn.execute("SELECT quantity_minimum FROM contracts WHERE symbol=?", (symbol,)).fetchone()
    qmin = row["quantity_minimum"] if row else 1.0
    with db.tx(conn):
        db.insert_trades(conn, symbol, trades)
        last_ts = db.last_trade_ts(conn, symbol)
        snap = make_snapshot(symbol, now, book, last_ts, qmin)
        snap_id = db.insert_snapshot(conn, symbol, now, book, snapshot_hash(snap))
        score = score_book(symbol, book.get("bids", []), book.get("asks", []),
                           now=now, last_trade_ts=last_ts, quantity_minimum=qmin)
        before = db.previous_grade(conn, symbol)
        db.insert_grade(conn, score, snap_id)
        if before and before != score.grade:
            db.insert_alert(conn, symbol, now, "grade_change", {"from": before, "to": score.grade})
        recent = [t for t in trades if now - int(t["timestamp"]) <= 3600]
        move = unusual_move(recent, score.move_cost_usd)
        if move:
            db.insert_alert(conn, symbol, now, "unusual_move", move)
    if move:
        incidents.open_move_incident(conn, symbol, move, now)
    return {"symbol": symbol, "grade": score.grade, "move_cost_usd": score.move_cost_usd}


def run(once: bool, limit: int) -> None:
    client, conn = Gemini(), db.connect()
    watchlist: list[str] = []
    next_discovery = 0.0
    try:
        while True:
            if time.time() >= next_discovery or not watchlist:
                watchlist = discover(client, conn, limit)
                next_discovery = time.time() + config.DISCOVERY_EVERY_S
            for symbol in watchlist:
                try:
                    r = record_one(client, conn, symbol)
                    log.info("%-40s %s  $%.2f", r["symbol"], r["grade"], r["move_cost_usd"])
                except Exception as exc:  # keep recording; one bad symbol shouldn't stop the run
                    log.warning("%s: %s", symbol, exc)
                if time.time() >= next_discovery and not once:
                    break
            checks = incidents.run_checks(conn)
            flagged = [c for c in checks if c["status"] not in ("coherent", "insufficient_data")]
            log.info("consistency: %d relations checked, %d flagged", len(checks), len(flagged))
            if once:
                return
    finally:
        client.close()
        conn.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="one pass, then exit")
    ap.add_argument("-n", "--limit", type=int, default=config.WATCHLIST_MAX)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    run(args.once, args.limit)


if __name__ == "__main__":
    main()
