# Grok Bot MCP Connector (Approach B)

> **For agentic workers:** execute task-by-task. Checkbox tracking.

**Goal:** Grok Bot investigates Thin Ice incidents via our MCP tools + a fixed skill prompt. No routine webhook yet.

## Files
- `backend/thin_ice/mcp_server.py` — already has tools (no code change unless Host/tunnel breaks)
- `web/docs/GROK_BOT_SETUP.md` — connector URL steps + pasteable skill
- Optional: start MCP `:8001` + `cloudflared tunnel --url http://localhost:8001`

## Tasks
- [x] Task 1: Write `web/docs/GROK_BOT_SETUP.md` (skill + connector steps)
- [x] Task 2: Start MCP server, verify `/mcp` responds locally
- [x] Task 3: Start Cloudflare quick tunnel; record public `https://…/mcp` URL
- [x] Task 4: Hand user the Grok UI steps (connector + skill paste)

## Done when
User can add Thin Ice as a custom connector and run: list open incidents → recheck → submit_report.
