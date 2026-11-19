"""Settings from environment variables (and backend/.env if present)."""

from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # python-dotenv is optional
    pass


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


# Gemini (public endpoints only; no API key needed for reading books)
GEMINI_REST = _env("GEMINI_REST", "https://api.gemini.com")
GEMINI_WS = _env("GEMINI_WS", "wss://ws.gemini.com")
# Sandbox, for the live "we moved it" demo only. Never place orders on production.
GEMINI_SANDBOX_REST = _env("GEMINI_SANDBOX_REST", "https://api.sandbox.gemini.com")
GEMINI_SANDBOX_WS = _env("GEMINI_SANDBOX_WS", "wss://ws.sandbox.gemini.com")

# Public REST limit is 120/min; Gemini recommends <= 1/s.
REQUESTS_PER_SECOND = float(_env("REQUESTS_PER_SECOND", "0.95"))
CATEGORIES = [c for c in _env(
    "CATEGORIES", "Politics,Economics,Crypto,Sports,Tech,Commodities,Weather"
).split(",") if c]
WATCHLIST_MAX = int(_env("WATCHLIST_MAX", "200"))
DISCOVERY_EVERY_S = int(_env("DISCOVERY_EVERY_S", "600"))
# Contracts streamed over WebSocket for the demo (comma-separated instrument symbols).
DEMO_SYMBOLS = [s for s in _env("DEMO_SYMBOLS").split(",") if s]

DB_PATH = Path(_env("DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "thin_ice.db")))
SNAPSHOT_DIR = Path(_env("SNAPSHOT_DIR", str(Path(__file__).resolve().parent.parent / "data" / "snapshots")))
# Public base URL where pinned snapshots can be downloaded (GitHub raw folder, IPFS gateway, or this API).
SNAPSHOT_BASE_URI = _env("SNAPSHOT_BASE_URI", "http://localhost:8000/api/snapshots")

# Solana (devnet)
SOLANA_RPC = _env("SOLANA_RPC", "https://api.devnet.solana.com")
ODDS_RECEIPT_PROGRAM_ID = _env("ODDS_RECEIPT_PROGRAM_ID")  # set after `anchor deploy`
RECEIPT_AUTHORITY_KEYPAIR = _env("RECEIPT_AUTHORITY_KEYPAIR")  # path to a JSON keypair file

ADMIN_TOKEN = _env("ADMIN_TOKEN")  # required for POST endpoints that mint
CORS_ORIGINS = [o for o in _env("CORS_ORIGINS", "http://localhost:3000").split(",") if o]

# Consistency engine
RELATIONS_PATH = Path(_env("RELATIONS_PATH", str(Path(__file__).resolve().parent.parent / "relations.json")))
# [verify] Gemini prediction-market trading fees; 0 means "before fees".
FEE_CENTS_PER_CONTRACT = float(_env("FEE_CENTS_PER_CONTRACT", "0"))
# Books recorded further apart than this can't confirm a contradiction (status "stale").
SYNC_TOLERANCE_S = int(_env("SYNC_TOLERANCE_S", "120"))

# Grok Bot Sentinel: routine webhook URL that receives new incidents (optional)
GROK_ROUTINE_WEBHOOK = _env("GROK_ROUTINE_WEBHOOK")
GROK_ROUTINE_TOKEN = _env("GROK_ROUTINE_TOKEN")  # sent as a Bearer header if set [verify]
PUBLIC_API_URL = _env("PUBLIC_API_URL", "http://localhost:8000")

# ElevenLabs Agents (Copilot). Keys stay server-side; the web app only gets a short-lived signed URL.
ELEVENLABS_API_KEY = _env("ELEVENLABS_API_KEY")
ELEVENLABS_AGENT_ID = _env("ELEVENLABS_AGENT_ID")
