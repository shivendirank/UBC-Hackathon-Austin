"""Live 1-second books for the ~20 demo markets over Gemini's WebSocket.

    python -m thin_ice.ws                # uses DEMO_SYMBOLS from .env
    python -m thin_ice.ws --sandbox      # sandbox feed, for the live "we moved it" demo

[verify] the subscribe message and the depth/trade payload shapes against
https://developer.gemini.com before relying on this. Rules from the docs: subscribe at most
once per symbol per minute. This module only reads; it never places orders.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import time

from . import config, db
from .receipts import make_snapshot, snapshot_hash
from .scoring import score_book

log = logging.getLogger("thin_ice.ws")


async def stream(symbols: list[str], url: str) -> None:
    import websockets

    conn = db.connect()
    params = [f"{s}@depth20" for s in symbols] + [f"{s}@trade" for s in symbols]
    async for socket in websockets.connect(url):  # reconnects with backoff
        try:
            await socket.send(json.dumps({"id": "1", "method": "subscribe", "params": params}))
            last_graded: dict[str, int] = {}
            async for raw in socket:
                msg = json.loads(raw)
                symbol = msg.get("s") or msg.get("symbol")  # [verify] field name
                if not symbol:
                    continue
                now = int(time.time())
                if "bids" in msg and "asks" in msg:
                    if last_graded.get(symbol) == now:
                        continue  # at most one grade per symbol per second
                    last_graded[symbol] = now
                    book = {"bids": _levels(msg["bids"]), "asks": _levels(msg["asks"])}
                    last_ts = db.last_trade_ts(conn, symbol)
                    with db.tx(conn):
                        snap = make_snapshot(symbol, now, book, last_ts, 1.0)
                        sid = db.insert_snapshot(conn, symbol, now, book, snapshot_hash(snap))
                        score = score_book(symbol, book["bids"], book["asks"], now=now, last_trade_ts=last_ts)
                        db.insert_grade(conn, score, sid)
                    log.info("%s %s $%.2f", symbol, score.grade, score.move_cost_usd)
        except websockets.ConnectionClosed:
            log.warning("socket closed; reconnecting")
            continue


def _levels(rows) -> list[dict]:
    """Accept [[price, amount], ...] or [{"price","amount"}, ...]."""
    out = []
    for r in rows:
        if isinstance(r, dict):
            out.append({"price": str(r["price"]), "amount": str(r.get("amount") or r.get("quantity"))})
        else:
            out.append({"price": str(r[0]), "amount": str(r[1])})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sandbox", action="store_true")
    ap.add_argument("symbols", nargs="*")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    symbols = args.symbols or config.DEMO_SYMBOLS
    if not symbols:
        raise SystemExit("Pass symbols or set DEMO_SYMBOLS")
    asyncio.run(stream(symbols, config.GEMINI_SANDBOX_WS if args.sandbox else config.GEMINI_WS))


if __name__ == "__main__":
    main()
