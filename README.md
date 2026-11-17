# Thin Ice

**Thin Ice checks whether prediction-market prices are supported by usable liquidity and logically
consistent with related markets, investigates unusual cases, and produces verifiable risk assessments.**
Full brief: [docs/Thin_Ice_Problem_and_Solution.md](docs/Thin_Ice_Problem_and_Solution.md).

1. **Liquidity & resilience:** from Gemini's live order books: the dollars needed to move the odds 10¢
   (A–F grade), execution price and slippage for $100–$5,000 trades, whether the visible book runs out,
   and how long markets stay thin over time.
2. **Consistency:** a graph of related contracts (price ladders, deadline ladders, single-winner sets).
   It finds the nearest consistent prices (isotonic regression / simplex projection), then checks
   whether a contradiction holds at **executable** bid/ask prices, in real size, after fees, with books
   recorded close together. Displayed contradictions are not treated as arbitrage.
3. **Grok Bot Sentinel:** flagged cases become incidents. Grok Bot investigates through our MCP
   tools (contract rules, history, fresh synchronized re-checks, news) and files a sourced conclusion:
   confirmed inconsistency, stale data, different rules, or inconclusive.
4. **Solana risk layer:** assessments (liquidity or consistency) are hashed and recorded on devnet with
   a grade and risk flags. Other programs read `Latest` and pause when the market is thin or inconsistent.

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

## Consistency checks

Implemented in [`backend/thin_ice/consistency.py`](backend/thin_ice/consistency.py).

| Relation | Rule | Executable test (all at real quotes, minus fees) |
|---|---|---|
| Price ladder ("$X or above", same event) | higher threshold ≤ lower | bid(higher) > ask(lower): sell the higher, buy the lower; size from walking both books |
| Deadline ladder ("Before …", same event) | earlier deadline ≤ later | same as above |
| Single-winner set | Σ P ≤ 100% | Σ best bids > 100¢: sell YES on all |
| Exactly-one set | Σ P = 100% | also Σ best asks < 100¢: buy YES on all |

Statuses: `coherent`, `theoretical_only` (contradiction on displayed prices only), `executable`,
`stale` (books recorded more than `SYNC_TOLERANCE_S` apart), `insufficient_data`.
Gemini's "categorical" events are often ladders or multi-select lists, so exclusivity is never
inferred from the event type: same-event ladders auto-verify; everything else waits for a human
(`backend/relations.json`).

## Proof: check any receipt yourself

```bash
cd backend && .venv/bin/python -m thin_ice.verify https://<api>/api/snapshots/<sha256>.json --expect-grade D
```

The snapshot JSON is canonical (sorted keys, no whitespace); its sha256 is the `snapshot_hash` stored
in the onchain `Receipt` account. Re-hash it, re-run the formula, compare.

## Repo layout

```
docs/       team brief (problem, solution, claims we can and can't make)
backend/    Python 3.12: recorder, liquidity + consistency engines, incidents, SQLite, FastAPI, MCP, verify CLI
programs/   Anchor workspace: odds_receipt (receipts + Latest grade), safe_payout (composability demo)
web/        Next.js 16 dashboard: markets, market page (grade, slippage, history, receipts), consistency, incidents, badge
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
| GET | `/api/relations?verified_only=` | relation graph with the latest check for each |
| POST | `/api/relations/{id}/assessment` | pin + record a consistency assessment (admin) |
| GET | `/api/incidents?status=open\|reported\|resolved` | incidents |
| GET | `/api/incidents/{id}` | evidence, timeline, latest check, contract rules, report |
| POST | `/api/incidents/{id}/report` | `{conclusion, summary, sources[], details}` (admin; used by Grok Bot) |

MCP tools (`python -m thin_ice.mcp_server`, for Grok Bot): `grade_market`, `get_receipt`, `mint_receipt`,
`list_incidents`, `get_incident`, `recheck`, `submit_report`, `publish_assessment`.

## Solana

- Program `odds_receipt` (devnet): `Receipt` PDA `["receipt", market_id, ts]`, `Latest` PDA `["latest", market_id]`,
  `market_id = sha256(subject)` (an instrument symbol, or `relation:<id>`). Each assessment has a
  `kind`, a grade and risk `flags`. Program ID: _fill in after deploy_.
- `safe_payout`: `settle(trusted_authority, max_age_s)` pauses if the assessment isn't from the trusted
  signer, is too old, grades worse than C, or is flagged inconsistent or one-sided.
- **Trust limit:** a receipt proves what Thin Ice committed and when, not that Gemini's data was
  complete or authentic. The pinned snapshot plus the open formulas let anyone recompute.

## Rules we follow

- Read-only on Gemini production; no trading of any kind in the product. Any live-move demo uses the sandbox.
- No accusations: grades describe liquidity, incidents describe pricing. Gemini's Liquidity Rewards
  Program is a real fix for part of this problem; Thin Ice measures what a reward formula alone can't guarantee.
- Synthetic replays are labeled as synthetic.

## Prior art (honest)

The "cost to move" idea exists in research (ACDC's *Gambling on Democracy* dashboard, Kyle's λ papers),
and Oddpool shows order-book depth for traders. What's new here is the combination: live per-market
grades, Gemini coverage, verifiable onchain receipts that other programs can read, and a badge/Grok Bot
check for everyday readers.
