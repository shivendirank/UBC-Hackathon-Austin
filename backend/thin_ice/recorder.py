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

from . import config, db
from .gemini import Gemini, open_contracts
from .receipts import make_snapshot, snapshot_hash
from .scoring import score_book, unusual_move

log = logging.getLogger("thin_ice.recorder")


def discover(client: Gemini, conn, limit: int) -> list[str]:
    """Refresh the contracts table and return the watchlist (demo symbols first)."""
    now = int(time.time())
    symbols: list[str] = list(config.DEMO_SYMBOLS)
    with db.tx(conn):
        for category in config.CATEGORIES:
            for event in client.events(category=category):
                for contract in open_contracts(event):
                    db.upsert_contract(conn, event, contract, now)
                    if contract["instrumentSymbol"] not in symbols:
                        symbols.append(contract["instrumentSymbol"])
    log.info("discovered %d open contracts", len(symbols))
    return symbols[:limit]


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
