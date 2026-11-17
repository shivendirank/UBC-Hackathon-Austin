"""SQLite storage (stdlib only). One file, WAL mode so the API can read while the recorder writes."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

from . import config
from .scoring import Score

SCHEMA = """
CREATE TABLE IF NOT EXISTS contracts (
    symbol TEXT PRIMARY KEY,
    event_ticker TEXT, event_title TEXT, event_slug TEXT, event_type TEXT,
    label TEXT, category TEXT, quantity_minimum REAL DEFAULT 1,
    expiry TEXT, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL, ts INTEGER NOT NULL,
    bids_json TEXT NOT NULL, asks_json TEXT NOT NULL, snapshot_hash TEXT
);
CREATE INDEX IF NOT EXISTS snapshots_symbol_ts ON snapshots(symbol, ts);
CREATE TABLE IF NOT EXISTS trades (
    tid INTEGER PRIMARY KEY, symbol TEXT NOT NULL, ts INTEGER NOT NULL,
    price REAL NOT NULL, amount REAL NOT NULL, side TEXT
);
CREATE INDEX IF NOT EXISTS trades_symbol_ts ON trades(symbol, ts);
CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL, ts INTEGER NOT NULL, grade TEXT NOT NULL,
    move_cost_usd REAL, cost_up_usd REAL, cost_down_usd REAL,
    best_bid_c INTEGER, best_ask_c INTEGER, spread_c INTEGER,
    exhausted INTEGER, snapshot_id INTEGER, score_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS grades_symbol_ts ON grades(symbol, ts);
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL, ts INTEGER NOT NULL, grade TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL, uri TEXT, tx_sig TEXT, receipt_pda TEXT, reason TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL, ts INTEGER NOT NULL, kind TEXT NOT NULL, detail_json TEXT NOT NULL
);
"""


def connect(path: Optional[Path] = None) -> sqlite3.Connection:
    path = Path(path or config.DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn


@contextmanager
def tx(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def upsert_contract(conn, event: dict, contract: dict, now: int) -> None:
    conn.execute(
        """INSERT INTO contracts(symbol, event_ticker, event_title, event_slug, event_type, label,
               category, quantity_minimum, expiry, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(symbol) DO UPDATE SET event_title=excluded.event_title, label=excluded.label,
               category=excluded.category, quantity_minimum=excluded.quantity_minimum,
               expiry=excluded.expiry, updated_at=excluded.updated_at""",
        (
            contract["instrumentSymbol"], event.get("ticker"), event.get("title"), event.get("slug"),
            event.get("type"), contract.get("label"), event.get("category"),
            float(contract.get("quantityMinimum") or 1), contract.get("expiryDate"), now,
        ),
    )


def insert_snapshot(conn, symbol: str, ts: int, book: dict, snapshot_hash: Optional[str] = None) -> int:
    cur = conn.execute(
        "INSERT INTO snapshots(symbol, ts, bids_json, asks_json, snapshot_hash) VALUES (?,?,?,?,?)",
        (symbol, ts, json.dumps(book.get("bids", [])), json.dumps(book.get("asks", [])), snapshot_hash),
    )
    return cur.lastrowid


def insert_trades(conn, symbol: str, trades: list[dict]) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO trades(tid, symbol, ts, price, amount, side) VALUES (?,?,?,?,?,?)",
        [(t["tid"], symbol, int(t["timestamp"]), float(t["price"]), float(t["amount"]), t.get("type"))
         for t in trades],
    )


def last_trade_ts(conn, symbol: str) -> Optional[int]:
    row = conn.execute("SELECT MAX(ts) FROM trades WHERE symbol=?", (symbol,)).fetchone()
    return row[0] if row and row[0] is not None else None


def insert_grade(conn, score: Score, snapshot_id: Optional[int]) -> None:
    conn.execute(
        """INSERT INTO grades(symbol, ts, grade, move_cost_usd, cost_up_usd, cost_down_usd,
               best_bid_c, best_ask_c, spread_c, exhausted, snapshot_id, score_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (score.symbol, score.ts, score.grade, score.move_cost_usd, score.cost_up_usd, score.cost_down_usd,
         score.best_bid_c, score.best_ask_c, score.spread_c, int(score.exhausted), snapshot_id,
         json.dumps(score.to_dict())),
    )


def previous_grade(conn, symbol: str) -> Optional[str]:
    row = conn.execute(
        "SELECT grade FROM grades WHERE symbol=? ORDER BY ts DESC, id DESC LIMIT 1", (symbol,)
    ).fetchone()
    return row["grade"] if row else None


def insert_alert(conn, symbol: str, ts: int, kind: str, detail: dict) -> None:
    conn.execute(
        "INSERT INTO alerts(symbol, ts, kind, detail_json) VALUES (?,?,?,?)",
        (symbol, ts, kind, json.dumps(detail)),
    )


LATEST_GRADES_SQL = """
SELECT g.*, c.event_title, c.event_slug, c.event_ticker, c.label, c.category, c.event_type
FROM grades g
JOIN (SELECT symbol, MAX(id) AS id FROM grades GROUP BY symbol) last ON last.id = g.id
LEFT JOIN contracts c ON c.symbol = g.symbol
"""
