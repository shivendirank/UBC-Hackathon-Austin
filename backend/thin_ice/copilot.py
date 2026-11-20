"""Copilot analysis helpers. Numbers come from the existing engines, not an LLM."""

from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from . import config, incidents, service


def market_analysis(conn, symbol: str) -> dict[str, Any]:
    m = service.get_market(conn, symbol, history_hours=72)
    if not m:
        raise LookupError(symbol)
    score = m["score"]
    return {
        "symbol": m["symbol"],
        "event_title": m.get("event_title"),
        "label": m.get("label"),
        "category": m.get("category"),
        "odds_pct": m.get("odds_pct"),
        "grade": m.get("grade"),
        "grade_words": m.get("grade_words"),
        "status": m.get("status"),
        "move_cost_usd": m.get("move_cost_usd"),
        "spread_c": m.get("spread_c"),
        "updated_at": m.get("updated_at"),
        "synthetic": bool(m.get("synthetic")),
        "liquidity_summary": (m.get("liquidity") or {}).get("summary"),
        "fills": (m.get("liquidity") or {}).get("fills", []),
        "depth": (m.get("liquidity") or {}).get("depth", {}),
        "resilience": m.get("resilience"),
        "reasons": score.get("reasons", []),
        "snapshot_hash": m.get("snapshot_hash"),
        "history": [
            {
                "ts": h["ts"],
                "odds_pct": ((h["best_bid_c"] + h["best_ask_c"]) / 2) if h.get("best_bid_c") is not None and h.get("best_ask_c") is not None else None,
                "move_cost_usd": h["move_cost_usd"],
                "grade": h["grade"],
            }
            for h in m.get("history", [])
        ],
    }


def related_markets(conn, symbol: str) -> dict[str, Any]:
    rels = []
    for r in incidents.relations(conn):
        if symbol not in r.members:
            continue
        row = conn.execute(
            "SELECT result_json FROM consistency_checks WHERE relation_id=? ORDER BY id DESC LIMIT 1",
            (r.id,),
        ).fetchone()
        check = json.loads(row["result_json"]) if row else None
        members = []
        for mem in r.members:
            m = service.get_market(conn, mem, history_hours=24)
            if m:
                members.append({
                    "symbol": m["symbol"],
                    "event_title": m.get("event_title"),
                    "label": m.get("label"),
                    "odds_pct": m.get("odds_pct"),
                    "grade": m.get("grade"),
                    "move_cost_usd": m.get("move_cost_usd"),
                })
        rels.append({
            "id": r.id,
            "kind": r.kind,
            "verified": r.verified,
            "note": r.note or None,
            "members": members,
            "latest_check": check,
        })
    return {"symbol": symbol, "relations": rels}


def compare_probabilities(conn, symbols: list[str]) -> dict[str, Any]:
    markets = []
    for sym in symbols:
        try:
            markets.append(market_analysis(conn, sym))
        except LookupError:
            markets.append({"symbol": sym, "error": "unknown or not yet graded"})
    return {"markets": markets}


def investigation_report(conn, incident_id: int) -> dict[str, Any]:
    inc = incidents.get_incident(conn, incident_id)
    if not inc:
        raise LookupError(str(incident_id))
    return inc


def elevenlabs_configured() -> bool:
    return bool(config.ELEVENLABS_API_KEY and config.ELEVENLABS_AGENT_ID)


def create_elevenlabs_session(context: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Mint a short-lived WebSocket signed URL. Never returns the API key.

    The browser starts the session with this URL. A WebRTC token was slower to
    reach a live mic here, so the open path stays on the signed URL.

    Prefer a fresh httpx client (a long-lived one can hit WinError 10013 on Windows).
    Fall back to urllib if httpx cannot open the socket.
    """
    if not elevenlabs_configured():
        return {
            "configured": False,
            "reason": "Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in backend/.env (see web/docs/COPILOT_SETUP.md).",
        }

    agent_id = config.ELEVENLABS_AGENT_ID
    headers = {"xi-api-key": config.ELEVENLABS_API_KEY}
    signed_url = f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={agent_id}"
    try:
        with httpx.Client(timeout=8.0, trust_env=True) as client:
            response = client.get(signed_url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            return {
                "configured": True,
                "agent_id": agent_id,
                "conversation_token": None,
                "signed_url": data.get("signed_url"),
                "context": context or {},
            }
        return {
            "configured": True,
            "agent_id": agent_id,
            "conversation_token": None,
            "signed_url": None,
            "error": f"ElevenLabs signed-url HTTP {response.status_code}: {response.text[:300]}",
            "context": context or {},
        }
    except (httpx.HTTPError, OSError) as e:
        # Windows sometimes blocks httpx sockets (WinError 10013); urllib often still works.
        try:
            import json
            import urllib.error
            import urllib.request

            req = urllib.request.Request(signed_url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return {
                "configured": True,
                "agent_id": agent_id,
                "conversation_token": None,
                "signed_url": data.get("signed_url"),
                "context": context or {},
            }
        except (urllib.error.URLError, OSError, TimeoutError, ValueError) as fallback_err:
            return {
                "configured": True,
                "agent_id": agent_id,
                "conversation_token": None,
                "signed_url": None,
                "error": f"ElevenLabs request failed: {e}; urllib fallback: {fallback_err}",
                "context": context or {},
            }
