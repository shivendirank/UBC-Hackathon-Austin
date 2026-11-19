"""CSV-backed storage for accounts and the latest market grades.

Users and market snapshots live under backend/data/ as plain CSV so the demo
can inspect or edit them without opening SQLite.
"""

from __future__ import annotations

import csv
import hashlib
import hmac
import secrets
import time
from pathlib import Path
from typing import Iterable, Optional

from . import config

DATA_DIR = config.DB_PATH.parent
USERS_CSV = Path(config._env("USERS_CSV", str(DATA_DIR / "users.csv")))
MARKETS_CSV = Path(config._env("MARKETS_CSV", str(DATA_DIR / "markets.csv")))

USER_FIELDS = ["email", "name", "password_hash", "salt", "created_at"]
MARKET_FIELDS = [
    "symbol", "event_title", "label", "category", "grade", "odds_pct",
    "move_cost_usd", "spread_c", "depth_pct", "status", "updated_at",
]

_AUTH_SECRET = (config.ADMIN_TOKEN or "thin-ice-dev-secret").encode()


def _ensure_dir() -> None:
    USERS_CSV.parent.mkdir(parents=True, exist_ok=True)
    MARKETS_CSV.parent.mkdir(parents=True, exist_ok=True)


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return digest.hex()


def _read_users() -> list[dict]:
    _ensure_dir()
    if not USERS_CSV.exists():
        with USERS_CSV.open("w", newline="") as f:
            csv.DictWriter(f, fieldnames=USER_FIELDS).writeheader()
        create_user("demo@thinice.local", "Demo", "demo1234")
        return _read_users()
    rows: list[dict] = []
    with USERS_CSV.open(newline="") as f:
        for row in csv.DictReader(f):
            if row.get("email"):
                rows.append(row)
    if not rows:
        create_user("demo@thinice.local", "Demo", "demo1234")
        return _read_users()
    return rows


def _write_users(rows: Iterable[dict]) -> None:
    _ensure_dir()
    with USERS_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=USER_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in USER_FIELDS})


def create_user(email: str, name: str, password: str) -> dict:
    email = email.strip().lower()
    name = name.strip() or email.split("@")[0]
    if not email or not password:
        raise ValueError("email and password are required")
    users = []
    if USERS_CSV.exists():
        with USERS_CSV.open(newline="") as f:
            users = [r for r in csv.DictReader(f) if r.get("email")]
    if any(u["email"] == email for u in users):
        raise ValueError("an account with that email already exists")
    salt = secrets.token_hex(16)
    row = {
        "email": email,
        "name": name,
        "password_hash": _hash_password(password, salt),
        "salt": salt,
        "created_at": str(int(time.time())),
    }
    users.append(row)
    _write_users(users)
    return {"email": email, "name": name}


def verify_user(email: str, password: str) -> Optional[dict]:
    email = email.strip().lower()
    for row in _read_users():
        if row["email"] != email:
            continue
        if hmac.compare_digest(row["password_hash"], _hash_password(password, row["salt"])):
            return {"email": row["email"], "name": row["name"]}
    return None


def issue_token(user: dict) -> str:
    """Stateless token: email|exp|hmac. Good enough for the local demo."""
    exp = int(time.time()) + 7 * 24 * 3600
    body = f"{user['email']}|{exp}"
    sig = hmac.new(_AUTH_SECRET, body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}|{sig}"


def user_from_token(token: str) -> Optional[dict]:
    try:
        email, exp_s, sig = token.strip().split("|", 2)
        exp = int(exp_s)
    except ValueError:
        return None
    if exp < int(time.time()):
        return None
    body = f"{email}|{exp}"
    expect = hmac.new(_AUTH_SECRET, body.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(expect, sig):
        return None
    for row in _read_users():
        if row["email"] == email.lower():
            return {"email": row["email"], "name": row["name"]}
    return None


def write_markets_csv(markets: list[dict]) -> Path:
    """Replace markets.csv with the latest graded contracts (real Gemini values)."""
    _ensure_dir()
    with MARKETS_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=MARKET_FIELDS)
        writer.writeheader()
        for m in markets:
            score = m.get("score") or {}
            writer.writerow({
                "symbol": m.get("symbol", ""),
                "event_title": m.get("event_title") or "",
                "label": m.get("label") or "",
                "category": m.get("category") or "",
                "grade": m.get("grade") or "",
                "odds_pct": "" if m.get("odds_pct") is None else m.get("odds_pct"),
                "move_cost_usd": m.get("move_cost_usd", ""),
                "spread_c": "" if m.get("spread_c") is None else m.get("spread_c"),
                "depth_pct": "" if score.get("depth_pct") is None else score.get("depth_pct"),
                "status": m.get("status") or "",
                "updated_at": m.get("updated_at") or "",
            })
    return MARKETS_CSV
