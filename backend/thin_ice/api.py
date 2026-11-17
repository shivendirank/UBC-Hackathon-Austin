"""REST API for the dashboard, the badge and Grok Bot.

    uvicorn thin_ice.api:app --reload --port 8000     (open /docs)
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import config, db, service

app = FastAPI(title="Thin Ice", version="0.1.0",
              description="How much would it cost to move these odds? Live grades for Gemini prediction markets.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

conn = db.connect()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/markets")
def markets(category: Optional[str] = None, sort: str = Query("fragile", pattern="^(fragile|deep)$"),
            limit: int = Query(100, le=500)):
    """Latest grade per contract. sort=fragile puts the cheapest-to-move first."""
    return {"markets": service.list_markets(conn, category, sort, limit)}


@app.get("/api/markets/{symbol}")
def market(symbol: str, hours: int = Query(72, le=24 * 14)):
    m = service.get_market(conn, symbol, hours)
    if not m:
        raise HTTPException(404, "unknown or not yet graded")
    return m


@app.get("/api/grade")
def grade(q: str):
    """Resolve a URL, symbol or text to a market and return its grade (used by Grok Bot and the badge)."""
    symbol = service.find_market(conn, q)
    if not symbol:
        raise HTTPException(404, "no matching Gemini market")
    return service.get_market(conn, symbol, history_hours=24)


@app.post("/api/markets/{symbol}/receipt")
def mint(symbol: str, x_admin_token: str = Header("")):
    if not config.ADMIN_TOKEN or x_admin_token != config.ADMIN_TOKEN:
        raise HTTPException(401, "X-Admin-Token required")
    try:
        return service.mint_receipt(conn, symbol)
    except LookupError:
        raise HTTPException(404, "unknown or not yet graded")


@app.get("/api/alerts")
def alerts(limit: int = Query(50, le=200)):
    rows = conn.execute(
        "SELECT a.id, a.symbol, a.ts, a.kind, a.detail_json, c.event_title, c.label FROM alerts a "
        "LEFT JOIN contracts c ON c.symbol = a.symbol ORDER BY a.ts DESC LIMIT ?", (limit,)).fetchall()
    return {"alerts": [dict(r, detail=json.loads(r["detail_json"])) for r in rows]}


@app.get("/api/snapshots/{name}")
def snapshot(name: str):
    """Pinned snapshot JSON, by <sha256>.json. Re-hash it and re-run verify.py to check a receipt."""
    h = name.removesuffix(".json")
    if len(h) != 64 or any(c not in "0123456789abcdef" for c in h):
        raise HTTPException(404)
    path = config.SNAPSHOT_DIR / f"{h}.json"
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="application/json")
