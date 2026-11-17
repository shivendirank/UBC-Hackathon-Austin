# Thin Ice

**How much would it cost to move these odds?** Thin Ice reads every live Gemini prediction market's
public order book, works out how many dollars it would take to push the odds 10 cents, and gives the
market an **A–F reliability grade**. Each grade can be stamped as a tamper-proof **receipt on Solana**
(the hash of the exact order book we used), so anyone can check what the odds were, how trustworthy
they were, and recompute the grade themselves. Other onchain apps can read the latest grade and refuse
to act on thin markets.

Built for the UBC 2026 Hackathon (DeFi & Onchain Apps track; Solana; Gemini Prediction Markets bounty;
Grok Bot bounty). All code written after kickoff.

> Grades describe **liquidity, not intent**. Thin Ice never says a market is manipulated; it says how
> much it would cost, so readers know how much weight to give the number.

## Scoring (the open formula)

Implemented in [`backend/thin_ice/scoring.py`](backend/thin_ice/scoring.py). Gemini books are the YES side.

```
costUp    = Σ ask levels priced below bestAsk + 10¢ : qty × price          (buy YES)
costDown  = Σ bid levels priced above bestBid − 10¢ : qty × (1 − price)    (sell YES = buy NO)
moveCost  = min(costUp, costDown)                                          (the cheaper direction)
```

| Grade | Condition |
|---|---|
| **A** | moveCost ≥ $10,000 and spread ≤ 3¢ |
| **B** | ≥ $2,500 |
| **C** | ≥ $1,000 |
| **D** | ≥ $100 |
| **F** | < $100, or a one-sided/empty book, or spread > 20¢ |

Modifiers: drop one grade if there's no trade in the last 24 h; cap at D if the spread is over 10¢.
If the book runs out before a 10¢ move, the cost is the whole side (flagged `exhausted`).
Categorical events are graded by their favorite contract. A ≥10¢ move within 10 minutes on a book
under $500 raises an "unusual move on a thin book" alert.

**Limits:** the visible book is a floor (hidden size and refills aren't visible), which is why we
record a time series rather than one snapshot.

## Proof: check any receipt yourself

```bash
cd backend && .venv/bin/python -m thin_ice.verify https://<api>/api/snapshots/<sha256>.json --expect-grade D
```

The snapshot JSON is canonical (sorted keys, no whitespace); its sha256 is the `snapshot_hash` stored
in the onchain `Receipt` account. Re-hash it, re-run the formula, compare.

## Repo layout

```
backend/    Python 3.12: recorder (Gemini REST + WebSocket), scoring, SQLite, FastAPI, MCP server, verify CLI
programs/   Anchor workspace: odds_receipt (receipts + Latest grade), safe_payout (composability demo)
web/        Next.js 16 dashboard: fragility ranking, market page with history, embeddable badge
```

## Run it

```bash
# backend (needs Python 3.11+; uv recommended)
cd backend && uv venv -p 3.12 .venv && uv pip install -p .venv -e ".[dev,chain]" && cp .env.example .env
.venv/bin/python -m thin_ice.recorder              # leave running; records ~200 contracts
.venv/bin/uvicorn thin_ice.api:app --port 8000     # API, docs at /docs
.venv/bin/python -m thin_ice.mcp_server            # MCP for Grok Bot on :8001/mcp
.venv/bin/pytest -q

# web
cd web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000

# Solana: see programs/README.md
```

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{"ok": true}` |
| GET | `/api/markets?category=&sort=fragile\|deep&limit=` | `{markets: [Market]}` latest grade per contract |
| GET | `/api/markets/{symbol}?hours=72` | `Market` + `history`, `receipts`, `alerts`, `snapshot_hash` |
| GET | `/api/grade?q=` | resolve a Gemini URL, symbol or free text to a market, then as above |
| POST | `/api/markets/{symbol}/receipt` | pin snapshot + record onchain (header `X-Admin-Token`) |
| GET | `/api/alerts` | grade changes and unusual moves |
| GET | `/api/snapshots/{sha256}.json` | pinned snapshot |

## Solana

- Program `odds_receipt` (devnet): `Receipt` PDA `["receipt", market_id, ts]`, `Latest` PDA `["latest", market_id]`,
  `market_id = sha256(instrument symbol)`. Program ID: _fill in after deploy_.
- `safe_payout`: `settle` fails with `ThinIce` if `Latest.grade` is worse than C.

## Rules we follow

- Read-only on Gemini production. The live "we moved it" demo uses the **sandbox** only.
- No trading for others. No accusations: "unusual move on a thin book".

## Prior art (honest)

The "cost to move" idea exists in research (ACDC's *Gambling on Democracy* dashboard, Kyle's λ papers),
and Oddpool shows order-book depth for traders. What's new here is the combination: live per-market
grades, Gemini coverage, verifiable onchain receipts that other programs can read, and a badge/Grok Bot
check for everyday readers.
