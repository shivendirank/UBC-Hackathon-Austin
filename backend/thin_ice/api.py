"""REST API for the dashboard, the badge and Grok Bot.

    uvicorn thin_ice.api:app --reload --port 8000     (open /docs)
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import config, copilot, csv_store, db, incidents, service

app = FastAPI(title="Thin Ice", version="0.1.0",
              description="How much would it cost to move these odds? Live grades for Gemini prediction markets.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
                   allow_credentials=True)

conn = db.connect()


class AuthBody(BaseModel):
    email: str
    password: str
    name: str = ""


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/auth/register")
def register(body: AuthBody):
    try:
        user = csv_store.create_user(body.email, body.name, body.password)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    token = csv_store.issue_token(user)
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def login(body: AuthBody):
    user = csv_store.verify_user(body.email, body.password)
    if not user:
        raise HTTPException(401, "invalid email or password")
    return {"token": csv_store.issue_token(user), "user": user}


def _user_from_auth(authorization: str) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    user = csv_store.user_from_token(token) if token else None
    if not user:
        raise HTTPException(401, "not signed in")
    return user


@app.get("/api/auth/me")
def me(authorization: str = Header("")):
    return {"user": _user_from_auth(authorization)}


@app.get("/api/watchlist")
def get_watchlist(authorization: str = Header("")):
    """Signed-in user's starred markets, with latest grades when available."""
    user = _user_from_auth(authorization)
    symbols = csv_store.list_watch_symbols(user["email"])
    markets = []
    for symbol in symbols:
        m = service.get_market(conn, symbol, history_hours=24)
        if m:
            markets.append(m)
        else:
            markets.append({"symbol": symbol, "missing": True})
    return {"symbols": symbols, "markets": markets}


@app.put("/api/watchlist/{symbol}")
def put_watch(symbol: str, authorization: str = Header("")):
    user = _user_from_auth(authorization)
    symbols = csv_store.add_watch(user["email"], symbol)
    return {"symbols": symbols, "watching": True}


@app.delete("/api/watchlist/{symbol}")
def delete_watch(symbol: str, authorization: str = Header("")):
    user = _user_from_auth(authorization)
    symbols = csv_store.remove_watch(user["email"], symbol)
    return {"symbols": symbols, "watching": False}


@app.get("/api/markets")
def markets(category: Optional[str] = None, sort: str = Query("fragile", pattern="^(fragile|deep)$"),
            limit: int = Query(100, le=500)):
    """Latest grade per contract. sort=fragile = cheapest two-sided first; empty books always last."""
    rows = service.list_markets(conn, category, sort, limit)
    csv_store.write_markets_csv(rows)
    return {"markets": rows, "csv": str(csv_store.MARKETS_CSV)}


@app.get("/api/markets/{symbol}")
def market(symbol: str, hours: int = Query(72, le=24 * 14),
           refresh: bool = Query(False, description="Re-pull the live Gemini book before responding")):
    m = service.refresh_from_gemini(conn, symbol) if refresh else service.get_market(conn, symbol, hours)
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


def _admin(token: str) -> None:
    if not config.ADMIN_TOKEN or token != config.ADMIN_TOKEN:
        raise HTTPException(401, "X-Admin-Token required")


@app.post("/api/markets/{symbol}/receipt")
def mint(symbol: str, x_admin_token: str = Header("")):
    _admin(x_admin_token)
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


# ---------- consistency + incidents ----------

@app.get("/api/relations")
def list_relations(verified_only: bool = False):
    """The relationship graph, each with its latest consistency check."""
    out = []
    for r in incidents.relations(conn, verified_only=verified_only):
        row = conn.execute("SELECT result_json FROM consistency_checks WHERE relation_id=? ORDER BY id DESC LIMIT 1",
                           (r.id,)).fetchone()
        out.append({**r.to_dict(), "latest_check": json.loads(row["result_json"]) if row else None})
    return {"relations": out}


@app.get("/api/incidents")
def list_incidents(status: Optional[str] = Query(None, pattern="^(open|reported|resolved)$"),
                   limit: int = Query(50, le=200)):
    return {"incidents": incidents.list_incidents(conn, status, limit)}


@app.get("/api/incidents/{incident_id}")
def incident(incident_id: int):
    inc = incidents.get_incident(conn, incident_id)
    if not inc:
        raise HTTPException(404)
    return inc


@app.post("/api/incidents/{incident_id}/investigate", status_code=202)
def investigate(incident_id: int):
    """Wake the Grok Bot routine webhook so it investigates and submit_report's back."""
    try:
        return incidents.request_investigation(conn, incident_id)
    except LookupError:
        raise HTTPException(404)
    except RuntimeError:
        raise HTTPException(
            503,
            "Grok routine webhook not configured. Set GROK_ROUTINE_WEBHOOK in backend/.env "
            "(see docs/GROK_BOT_SETUP.md).",
        )
    except ConnectionError:
        raise HTTPException(502, "Grok routine webhook did not accept the request.")


class Report(BaseModel):
    conclusion: str
    summary: str
    sources: list[str] = []
    details: str = ""


@app.post("/api/incidents/{incident_id}/report")
def report(incident_id: int, body: Report, x_admin_token: str = Header("")):
    """Grok Bot (or a person) files the investigation result."""
    _admin(x_admin_token)
    if not incidents.get_incident(conn, incident_id):
        raise HTTPException(404)
    try:
        return incidents.submit_report(conn, incident_id, body.conclusion, body.summary, body.sources, body.details)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.post("/api/relations/{relation_id}/assessment")
def publish_assessment(relation_id: str, x_admin_token: str = Header("")):
    """Pin + record a consistency assessment (call for significant, confirmed findings)."""
    _admin(x_admin_token)
    try:
        return service.mint_consistency(conn, relation_id)
    except LookupError:
        raise HTTPException(404)


# ---------- Copilot (voice agent tools; deterministic engines only) ----------

class CopilotSessionBody(BaseModel):
    symbol: Optional[str] = None
    path: Optional[str] = None


class CompareBody(BaseModel):
    symbols: list[str]


@app.get("/api/copilot/status")
def copilot_status():
    return {
        "elevenlabs_configured": copilot.elevenlabs_configured(),
        "agent_id_set": bool(config.ELEVENLABS_AGENT_ID),
        "api_key_set": bool(config.ELEVENLABS_API_KEY),
    }


@app.post("/api/copilot/session")
def copilot_session(body: CopilotSessionBody = CopilotSessionBody()):
    ctx = {"symbol": body.symbol, "path": body.path}
    return copilot.create_elevenlabs_session(ctx)


@app.get("/api/copilot/resolve")
def copilot_resolve(q: str = Query(..., min_length=1)):
    """Resolve a spoken/typed market name, Gemini URL, or symbol to a graded contract."""
    symbol = service.find_market(conn, q)
    if not symbol:
        raise HTTPException(404, "no matching Gemini market in Thin Ice yet")
    try:
        analysis = copilot.market_analysis(conn, symbol)
    except LookupError:
        raise HTTPException(404, "matched symbol has no grade yet")
    return {
        "query": q,
        "symbol": symbol,
        "path": f"/market/{symbol}",
        "event_title": analysis.get("event_title"),
        "label": analysis.get("label"),
        "odds_pct": analysis.get("odds_pct"),
        "grade_words": analysis.get("grade_words"),
        "move_cost_usd": analysis.get("move_cost_usd"),
    }


@app.get("/api/copilot/markets/{symbol}/analysis")
def copilot_analysis(symbol: str):
    try:
        return copilot.market_analysis(conn, symbol)
    except LookupError:
        raise HTTPException(404, "unknown or not yet graded")


@app.get("/api/copilot/markets/{symbol}/related")
def copilot_related(symbol: str):
    return copilot.related_markets(conn, symbol)


@app.post("/api/copilot/compare")
def copilot_compare(body: CompareBody):
    if not body.symbols or len(body.symbols) > 12:
        raise HTTPException(422, "provide 1–12 symbols")
    return copilot.compare_probabilities(conn, body.symbols)


@app.get("/api/copilot/incidents/{incident_id}")
def copilot_incident(incident_id: int):
    try:
        return copilot.investigation_report(conn, incident_id)
    except LookupError:
        raise HTTPException(404)
