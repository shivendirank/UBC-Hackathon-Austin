"""Labeled synthetic replay, for when Gemini's events API is down.

Writes two fictional contracts on one ladder, grades them with the real formula, and opens an
incident through the real consistency engine. Every row is marked synthetic. Nothing here is a
Gemini quote.

    python -m thin_ice.synthetic
"""

from __future__ import annotations

import json
import time

from . import db, incidents
from .receipts import make_snapshot, snapshot_hash
from .scoring import score_book

RELATION_ID = "synthetic:ladder:btc-dec31"
LOW = "SYNTHETIC-BTC-100K"
HIGH = "SYNTHETIC-BTC-150K"
RULES = (
    "SYNTHETIC REPLAY. These order books were written by Thin Ice for a demo. "
    "They were not read from Gemini. Both contracts share one fictional settlement: "
    "Bitcoin's price on December 31, 2026. A finish above $150,000 is also a finish above "
    "$100,000, so the higher threshold cannot be priced as more likely than the lower one."
)

# Same shape as the executable ladder test: the higher threshold's bid crosses the lower threshold's ask.
BOOKS = {
    LOW: {"bids": [{"price": "0.68", "amount": "40"}], "asks": [{"price": "0.70", "amount": "40"}]},
    HIGH: {"bids": [{"price": "0.85", "amount": "20"}], "asks": [{"price": "0.87", "amount": "20"}]},
}
LABELS = {LOW: "$100,000 or above", HIGH: "$150,000 or above"}


def _clear(conn) -> None:
    with db.tx(conn):
        for table in ("grades", "snapshots", "trades", "alerts", "receipts"):
            conn.execute(f"DELETE FROM {table} WHERE symbol LIKE 'SYNTHETIC-%'")
        conn.execute("DELETE FROM contracts WHERE symbol LIKE 'SYNTHETIC-%'")
        conn.execute("DELETE FROM consistency_checks WHERE relation_id LIKE 'synthetic:%'")
        conn.execute("DELETE FROM incidents WHERE subject LIKE 'synthetic:%'")
        conn.execute("DELETE FROM relations WHERE source = 'synthetic' OR id LIKE 'synthetic:%'")


def load(conn) -> dict:
    """Replace any previous synthetic replay and return the new incident."""
    _clear(conn)
    now = int(time.time())
    event = {
        "ticker": "SYNTHETIC-BTC-DEC31",
        "title": "Synthetic replay: Bitcoin finishes above a threshold on Dec 31, 2026",
        "slug": "synthetic-btc-dec31",
        "type": "categorical",
        "category": "Synthetic",
        "termsLink": None,
    }
    with db.tx(conn):
        for symbol, label in LABELS.items():
            db.upsert_contract(conn, event, {
                "instrumentSymbol": symbol,
                "label": label,
                "quantityMinimum": "1",
                "description": RULES,
                "expiryDate": "2026-12-31T23:59:59Z",
            }, now)
            trade = {"tid": 9_000_000_001 if symbol == LOW else 9_000_000_002,
                     "timestamp": now - 60, "price": "0.69" if symbol == LOW else "0.86",
                     "amount": "5", "type": "buy"}
            db.insert_trades(conn, symbol, [trade])
            snap = make_snapshot(symbol, now, BOOKS[symbol], now - 60, 1.0, source="synthetic replay")
            snap_id = db.insert_snapshot(conn, symbol, now, BOOKS[symbol], snapshot_hash(snap))
            score = score_book(symbol, BOOKS[symbol]["bids"], BOOKS[symbol]["asks"],
                               now=now, last_trade_ts=now - 60, quantity_minimum=1.0)
            db.insert_grade(conn, score, snap_id)
        conn.execute(
            """INSERT INTO relations(id, kind, members_json, source, verified, event_ticker, note, updated_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (RELATION_ID, "threshold_ladder", json.dumps([LOW, HIGH]), "synthetic", 1,
             event["ticker"],
             "Synthetic replay. Same fictional settlement: a higher threshold cannot be more likely.",
             now),
        )
    checks = incidents.run_checks(conn, now)
    flagged = next(c for c in checks if c["relation_id"] == RELATION_ID)
    row = conn.execute(
        "SELECT id FROM incidents WHERE kind='inconsistency' AND subject=? ORDER BY id DESC LIMIT 1",
        (RELATION_ID,),
    ).fetchone()
    return {
        "synthetic": True,
        "relation_id": RELATION_ID,
        "status": flagged["status"],
        "summary": flagged["summary"],
        "incident_id": row["id"] if row else None,
        "symbols": [
            {"symbol": s, "label": LABELS[s], "grade": score_book(
                s, BOOKS[s]["bids"], BOOKS[s]["asks"], now=now, last_trade_ts=now - 60).grade}
            for s in (LOW, HIGH)
        ],
    }


def main() -> None:
    logging_setup()
    result = load(db.connect())
    print(json.dumps(result, indent=2))


def logging_setup() -> None:
    import logging
    logging.basicConfig(level=logging.INFO, format="%(message)s")


if __name__ == "__main__":
    main()
