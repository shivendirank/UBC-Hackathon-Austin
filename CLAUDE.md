# Thin Ice: build context for Claude Code

UBC 2026 Hackathon (University Blockchain Conference, finals in person at UT Austin, Sat Nov 21).
**Devpost deadline: Fri Nov 20, 12:00 PM CST.** Track: **DeFi & Onchain Apps**. Chain award: **Solana**.
Bounties: **Gemini Prediction Markets** (1st place = finals slot), **Grok Bot**, optional QuickNode Streams.
Repo must be public, all work after kickoff (Nov 13), 2–3 min video, README covers scoring, risks, program ID.

**The team spec is [`docs/Thin_Ice_Problem_and_Solution.md`](docs/Thin_Ice_Problem_and_Solution.md)
(Nov 17). It wins over this file on scope and claims.** This file says how the code maps to it.

## 1. What it is (spec section 1)
Thin Ice checks whether prediction-market prices are supported by usable liquidity and logically
consistent with related markets, investigates unusual cases, and produces verifiable risk assessments.

| Spec component | Code |
|---|---|
| 1. Liquidity & resilience engine | `scoring.py` (cost to move 10¢, A–F grade), `liquidity.py` (fills/slippage per trade size, depth bands, exhaustion, thin-time share, depth around moves) |
| 2. Mathematical consistency engine | `consistency.py` (relation graph, isotonic + simplex projection, execution-aware checks with fees and sync) |
| 3. Grok Bot Sentinel | `incidents.py` (open/update/resolve, webhook to Grok routine), `mcp_server.py` tools |
| 4. Solana verification & risk layer | `receipts.py` (snapshots, hashing, `Assessment` + flags, Anchor encoding), `programs/odds_receipt`, `programs/safe_payout` |
| Dashboard | `web/`: Markets, market page (grade, slippage table, history, receipts), Consistency, Incidents, badge |

## 2. Layout
```
docs/      team spec (source of truth for scope and claims)
backend/   Python 3.12, FastAPI, SQLite, httpx, websockets, mcp 2.x (MCPServer, not FastMCP), solders
  thin_ice/scoring.py      liquidity grade formula. Pure. Bump FORMULA_VERSION when math/grades change.
  thin_ice/liquidity.py    fills, slippage, depth, resilience over time. Pure.
  thin_ice/consistency.py  relations, discovery, projections, execution-aware check. Pure.
  thin_ice/incidents.py    relations sync, run_checks, incident lifecycle, Grok webhook, recheck, reports
  thin_ice/receipts.py     snapshot JSON + sha256, Assessment kinds/flags, Anchor encoding, ReceiptMinter
  thin_ice/recorder.py     discovery + rolling book/trade polling (<= 1 req/s) + consistency pass
  thin_ice/ws.py           1 s books for DEMO_SYMBOLS [verify message shapes]
  thin_ice/service.py      read logic + mint_receipt / mint_consistency, shared by api.py and mcp_server.py
  thin_ice/verify.py       public "check a receipt" CLI (liquidity and consistency snapshots)
  relations.json           hand-verified relations (override suggestions by id)
programs/  Anchor 0.31.1: odds_receipt, safe_payout   (NOT compiled yet: no Rust on the Mac)
web/       Next.js 16.4 + React 19.3 + Tailwind 4, cacheComponents on. Read web/AGENTS.md first.
```

## 3. Commands
```bash
cd backend && .venv/bin/pytest -q                       # must pass before calling a task done
cd backend && .venv/bin/python -m thin_ice.recorder --once -n 20
cd backend && .venv/bin/uvicorn thin_ice.api:app --port 8000
cd backend && .venv/bin/python -m thin_ice.mcp_server   # :8001/mcp for Grok Bot
cd web && npx tsc --noEmit && npm run lint && npm run build   # Node at ~/.local/node/bin on the Mac
```

## 4. Rules
1. **Never place orders on Gemini production.** Sandbox only for any live-move demo (CFTC/ToS).
2. Gemini public REST: 120 req/min; stay <= 1 req/s. WebSocket: <= 1 subscribe per symbol per minute.
3. Wording: describe liquidity and pricing, never intent. No "manipulation" claims. Don't claim rewards
   are ineffective or that a grade predicts outcomes (spec section 9).
4. A displayed contradiction is not arbitrage. Only `executable` (bid/ask, size, fees, synced books)
   may be called tradeable. Synthetic replays must be labeled synthetic in the UI and video.
5. **Gemini "categorical" ≠ mutually exclusive.** Many are threshold ladders ("$64,500 or above") or
   multi-select ("Who will leave…"). Only same-event ladders auto-verify; exclusive sets need a human to
   read the rules and add them to `relations.json`. Only verified relations open incidents.
6. Byte layouts and flag bits in `receipts.py` and `programs/odds_receipt/src/lib.rs` must match;
   update both and `tests/test_scoring.py`.
7. API shapes: `web/lib/api.ts` mirrors `backend/thin_ice/service.py`, `incidents.py`, `consistency.py`.
8. Keys/keypairs only in `backend/.env` (gitignored). The web app knows only `NEXT_PUBLIC_API_URL`.
9. Mark unverified facts `[verify]`. The "$27 median" from the deep dive is not yet a validated claim.
   Don't claim the cost-to-move metric is new (ACDC, Oddpool exist).

## 5. Status (Nov 17, evening)
Done and tested (34 tests): grade + liquidity/slippage + resilience; consistency engine with relation
discovery (live: 22 BTC/ETH/SOL/XRP/… threshold ladders, 3 deadline ladders, 11 suggested exclusive sets),
projections and executable checks; incidents with timeline, auto-resolve, Grok report endpoint and MCP
tools (`grade_market`, `get_receipt`, `mint_receipt`, `list_incidents`, `get_incident`, `recheck`,
`submit_report`, `publish_assessment`); pinned liquidity and consistency snapshots + verify CLI;
Anchor programs with `kind` + `flags` and a trusted-authority policy check; web pages (build passes).

To do: install Rust/Solana/Anchor, build + deploy, mint a real receipt; deploy recorder and leave it
running (put verified relation members first so books stay in sync); verify Gemini fees
(`FEE_CENTS_PER_CONTRACT`); find a live anomaly or prepare a labeled synthetic replay; Grok Bot
connector + skill + routine webhook; hand-verify a few exclusive sets; video; Devpost.

## 6. Cut order if behind (spec section 10)
Reward-effectiveness comparison → X-post handoff → QuickNode → badge → Grok routine (keep manual
investigation). Never cut: recorder history, liquidity math, consistency checker, one validated or
labeled-synthetic anomaly, receipts + policy demo, dashboard, video.
