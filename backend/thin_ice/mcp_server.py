"""MCP server for Grok Bot's custom connector (remote HTTPS MCP).

    python -m thin_ice.mcp_server            # streamable HTTP on :8001/mcp
    cloudflared tunnel --url http://localhost:8001   # give Grok Bot the https URL + /mcp

Tools: grade_market, get_receipt, mint_receipt.
"""

from __future__ import annotations

import os

from mcp.server.mcpserver import MCPServer  # mcp 2.x (FastMCP was renamed)

from . import db, incidents, service
from .gemini import Gemini

mcp = MCPServer("thin-ice", instructions="Grades how much money it would take to move a Gemini prediction market's odds.")
conn = db.connect()


@mcp.tool()
def grade_market(query: str) -> dict:
    """Grade a Gemini prediction market. `query` is a Gemini market URL, an instrument symbol,
    or text describing the market (for example the wording of an X post quoting odds).
    Returns the A-F grade, the dollars needed to move the odds 10 cents, and plain-English words."""
    symbol = service.find_market(conn, query)
    if not symbol:
        return {"found": False, "message": "No matching Gemini market. Try a Gemini URL."}
    m = service.get_market(conn, symbol, history_hours=24) or {}
    m.pop("history", None)
    return {"found": True, **m}


@mcp.tool()
def get_receipt(symbol: str) -> dict:
    """Most recent onchain receipts for a market (Solana devnet), with explorer links."""
    m = service.get_market(conn, symbol, history_hours=1)
    return {"symbol": symbol, "receipts": (m or {}).get("receipts", [])}


@mcp.tool()
def mint_receipt(symbol: str) -> dict:
    """Pin the current order book for `symbol` and record its hash and grade on Solana.
    Use after grade_market so the verdict links to a tamper-proof receipt."""
    try:
        return service.mint_receipt(conn, symbol, reason="grok_bot")
    except LookupError:
        return {"error": f"{symbol} is not graded yet"}


@mcp.tool()
def list_incidents(status: str = "open") -> dict:
    """Incidents the deterministic engines flagged: price inconsistencies across related contracts
    and unusual moves on thin books. status: open | reported | resolved."""
    rows = incidents.list_incidents(conn, status or None, 20)
    return {"incidents": [{k: r[k] for k in ("id", "kind", "subject", "status", "conclusion", "opened_at", "synthetic")} for r in rows]}


@mcp.tool()
def get_incident(incident_id: int) -> dict:
    """Full evidence for an incident: the engine output, timeline, latest check, and each contract's
    settlement rules and expiry (compare these to decide 'different_rules')."""
    return incidents.get_incident(conn, incident_id) or {"error": "not found"}


@mcp.tool()
def recheck(incident_id: int) -> dict:
    """Fetch fresh, synchronized order books for every contract in the incident and re-run the math.
    Use this before concluding: it separates stale-quote artifacts from real inconsistencies.
    A synthetic replay reuses the stored books and does not call Gemini."""
    client = Gemini()
    try:
        return incidents.recheck(conn, client, incident_id)
    except (LookupError, ValueError) as exc:
        return {"error": str(exc)}
    finally:
        client.close()


@mcp.tool()
def submit_report(incident_id: int, conclusion: str, summary: str, sources: list[str], details: str = "") -> dict:
    """File the investigation. conclusion: confirmed_inconsistency | stale_data | different_rules |
    inconclusive | no_issue. Cite sources (URLs). Describe liquidity and pricing, never intent:
    do not allege manipulation."""
    try:
        return incidents.submit_report(conn, incident_id, conclusion, summary, sources, details)
    except ValueError as exc:
        return {"error": str(exc)}


@mcp.tool()
def publish_assessment(incident_id: int) -> dict:
    """For a significant finding you concluded 'confirmed_inconsistency': pin the books and record the
    consistency assessment on Solana so other apps can apply their risk policy."""
    inc = incidents.get_incident(conn, incident_id)
    if not inc or inc["kind"] != "inconsistency":
        return {"error": "publish_assessment needs an inconsistency incident"}
    return service.mint_consistency(conn, inc["subject"], reason=f"incident:{incident_id}")


if __name__ == "__main__":
    # [verify] behind cloudflared: if requests are rejected for the Host header, pass
    # transport_security=TransportSecuritySettings(...) allowing the tunnel hostname.
    mcp.run(transport="streamable-http", host="0.0.0.0", port=int(os.getenv("MCP_PORT", "8001")))
