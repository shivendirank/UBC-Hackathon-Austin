# Thin Ice: build context for Claude Code

UBC 2026 Hackathon (University Blockchain Conference, finals in person at UT Austin, Sat Nov 21).
**Devpost deadline: Fri Nov 20, 12:00 PM CST.** Track: **DeFi & Onchain Apps**. Chain award: **Solana**.
Bounties: **Gemini Prediction Markets** (1st place = finals slot), **Grok Bot**, optional QuickNode Streams.
Repo must be public, all work after kickoff (Nov 13), 2–3 min video, README covers scoring, risks, program ID.

> If a newer team spec exists (e.g. `docs/Thin_Ice_Problem_and_Solution.md`), it overrides this file.

## 1. What it is
Live A–F reliability grades for Gemini prediction markets: dollars needed to move the odds 10¢,
from the public order book. Receipts (sha256 of the exact book) recorded on Solana devnet; a `Latest`
account other programs read; dashboard + embeddable badge; MCP server so Grok Bot can grade a post.

## 2. Layout
```
backend/   Python 3.12, FastAPI, SQLite, httpx, websockets, mcp 2.x (MCPServer, not FastMCP), solders
  thin_ice/scoring.py    THE formula. Pure. Change FORMULA_VERSION when math or grades change.
  thin_ice/receipts.py   snapshot canonical JSON + hash; Anchor instruction encoding; ReceiptMinter
  thin_ice/recorder.py   discovery + rolling book/trade polling (<= 1 req/s)
  thin_ice/ws.py         1 s books for DEMO_SYMBOLS [verify message shapes]
  thin_ice/service.py    read logic shared by api.py and mcp_server.py
  thin_ice/verify.py     public "check a receipt" CLI
programs/  Anchor 0.31.1 workspace: odds_receipt, safe_payout   (NOT compiled yet: no Rust on the Mac)
web/       Next.js 16.4 + React 19.3 + Tailwind 4, cacheComponents on. Read web/AGENTS.md first.
```

## 3. Commands
```bash
cd backend && .venv/bin/pytest -q                       # must pass before calling a task done
cd backend && .venv/bin/python -m thin_ice.recorder --once -n 20
cd backend && .venv/bin/uvicorn thin_ice.api:app --port 8000
cd web && npx tsc --noEmit && npm run lint && npm run build   # Node at ~/.local/node/bin on the Mac
```

## 4. Rules
1. **Never place orders on Gemini production.** Sandbox only for the live-move demo (CFTC/ToS).
2. Gemini public REST: 120 req/min; stay <= 1 req/s. WebSocket: <= 1 subscribe per symbol per minute.
3. Wording: grades describe liquidity, not intent. Alerts say "unusual move on a thin book".
4. Byte layouts in `receipts.py` and `programs/odds_receipt/src/lib.rs` must match; update both + the test.
5. API shapes: `web/lib/api.ts` mirrors `backend/thin_ice/service.py`. Call out any change.
6. Keys/keypairs only in `backend/.env` (gitignored). The web app knows only `NEXT_PUBLIC_API_URL`.
7. Mark unverified facts `[verify]`. Don't claim the "cost to move" metric is new (ACDC, Oddpool exist).

## 5. Status (Nov 17)
Done: scoring + tests, recorder (tested live on Gemini), SQLite, REST API, MCP server (3 tools),
pinning + verify CLI (tested), Anchor programs written, dashboard/market/badge pages (build passes).
To do: install Rust/Solana/Anchor, build + deploy programs, mint a real receipt; deploy recorder (VPS/
Railway) and leave it running; Grok Bot connector + skill + routine; sandbox live-move rehearsal;
alerts UI; QuickNode Stream (optional); video; Devpost.

## 6. Cut order if behind
QuickNode → safe_payout → badge → Grok Bot routine (flow B) → Grok Bot. Never cut: recorder history,
scoring, receipts, dashboard, video.
