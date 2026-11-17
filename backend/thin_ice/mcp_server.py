"""MCP server for Grok Bot's custom connector (remote HTTPS MCP).

    python -m thin_ice.mcp_server            # streamable HTTP on :8001/mcp
    cloudflared tunnel --url http://localhost:8001   # give Grok Bot the https URL + /mcp

Tools: grade_market, get_receipt, mint_receipt.
"""

from __future__ import annotations

import os

from mcp.server.mcpserver import MCPServer  # mcp 2.x (FastMCP was renamed)

from . import db, service

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


if __name__ == "__main__":
    # [verify] behind cloudflared: if requests are rejected for the Host header, pass
    # transport_security=TransportSecuritySettings(...) allowing the tunnel hostname.
    mcp.run(transport="streamable-http", host="0.0.0.0", port=int(os.getenv("MCP_PORT", "8001")))
