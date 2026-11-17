# THIN ICE
## Problem & Solution Brief
**Project:** Prediction-Market Intelligence, Verification & Investigation  
**Prepared:** November 17, 2026  
**Context:** UBC Austin Hackathon 2026

## 1. The idea in one sentence
**Thin Ice checks whether prediction-market prices are supported by usable liquidity and logically consistent with related markets, investigates unusual cases, and produces verifiable risk assessments.**

## 2. Background: What is a prediction market?
A prediction market lets people trade contracts on future outcomes. For example, a market might ask: **“Will Bitcoin exceed $150,000 by December 31?”** A YES contract trading at $0.70 is often interpreted as roughly a 70% probability. That is a *market-implied price*, not a proven fact or a guaranteed accurate forecast.

**Liquidity** means how easily someone can buy or sell without changing the price too much. An active market may have many orders at nearby prices; a *thin market* has very few. When a market is thin, a relatively small purchase or sale can move the displayed odds significantly.

## 3. The actual problems

### Problem A — A headline probability can hide a fragile market
A user may see **“80% chance”** without realizing that there are very few buy and sell offers behind the price. A small trade could cause a sharp price change. That does **not** prove manipulation or that the forecast is wrong; it means the quote may be fragile.

**Example (illustrative):** A YES contract is priced around 70¢. Only a small amount of nearby sell liquidity is available. A buyer consumes those sell offers, and the next available quote is 80¢. A news reader might interpret that move as new information even if it was largely caused by limited depth.

### Problem B — Liquidity can disappear when it is most needed
Even a market with adequate orders at noon can become thin during breaking news or rapid price movements. Market makers can cancel *unfilled* orders to limit risk. So a snapshot showing good liquidity does not guarantee that liquidity will remain available.

### Problem C — Related markets can contradict each other
Suppose two contracts have **exactly matching event definitions, deadlines, and settlement conditions**:

- Bitcoin finishes above $100K: **70%**
- Bitcoin finishes above $150K: **85%**

If Bitcoin finishes above $150K, it must also finish above $100K. Therefore the coherent probability relationship is:

**P(BTC > $150K) ≤ P(BTC > $100K)**

The quoted numbers violate that ordering. But we must check whether prices are current and executable, and whether contract definitions truly match. A displayed contradiction is **not automatically a real arbitrage opportunity**.

### Problem D — Existing alerts often cannot explain why something happened
An anomaly might result from stale quotes, different settlement rules, missing liquidity, breaking news, or a genuine executable pricing discrepancy. A bare red warning or “Grade F” does not tell users which explanation is supported by evidence.

## 4. What Gemini is already doing (and what it does not guarantee)
Gemini's **Liquidity Rewards Program**, updated November 10, 2026, pays qualifying market makers for making buy and sell orders available. Its published methodology uses minute-by-minute order-book snapshots, favors larger and closer two-sided quotes, and has qualifying size and spread requirements.

**This is a real solution to part of the problem.** Paying market makers can improve liquidity by compensating them for taking trading risk. It would be inaccurate to say the program “does nothing.”

However, the rewards formula **does not by itself guarantee**:

1. Orders remain available throughout every second or during volatile conditions.
2. Traders always experience low slippage.
3. Different, related contracts have mathematically coherent prices.
4. A viewer or downstream app can tell whether the displayed odds deserve caution.

**Important:** These are limitations of what a reward formula guarantees—not evidence that Gemini is failing or that its makers are abusing the program. We need live measurements to establish the frequency of these problems on Gemini.

Official reference: https://developer.gemini.com/prediction-markets/liquidity-rewards-program

## 5. Our solution: Four connected components

### 1) Liquidity & resilience engine — *How strong is the market?*
Thin Ice reads Gemini's live order book and calculates:

- Bid/ask spread and available buy/sell depth.
- Hypothetical execution price and slippage for specified trade sizes.
- Whether visible orders run out before an intended execution size is filled.
- How liquidity changes over time, including around rapid price moves.
- How long thin conditions persist rather than relying on a single snapshot.

**What the user sees:** “The displayed 80% quote is sensitive to relatively small trades,” with supporting measurements instead of only a letter grade.

### 2) Mathematical consistency engine — *Do related markets make logical sense?*
Thin Ice identifies groups of contracts with verified relationships, such as:

- A higher threshold must be no more probable than a lower threshold.
- Mutually exclusive outcomes cannot add up to more than 100%.
- A complete set of mutually exclusive outcomes should total 100% in an idealized coherent probability model.

It uses **Python, graph relationships, and mathematical optimization**. Crucially, it then checks timestamps, contract settlement rules, executable bid/ask prices, order-book depth and fees to distinguish *theoretical* contradictions from actionable ones.

**What the user sees:** “These two contracts appear inconsistent, but the executable quotes are too thin to establish a tradeable discrepancy,” or a clearly supported explanation of a validated violation.

### 3) Grok Bot Sentinel — *What happened, and why?*
Grok Bot is **not the mathematical calculator**. Deterministic code performs the calculations; Grok Bot investigates flagged cases.

When Thin Ice detects an important anomaly, Grok Bot can:

1. Retrieve both contracts' exact rules and timestamps.
2. Compare recorded market history and price changes.
3. Research relevant news and publicly available context.
4. Request updated calculations from the math engine.
5. Produce an evidence-backed incident report with a conclusion such as **confirmed inconsistency**, **stale-data issue**, **different rules**, or **inconclusive**.
6. Revisit the incident when new data arrives and track whether the issue resolves.

Grok Bot can also support a user-driven workflow such as checking a prediction-market claim shared on X. The goal is **fewer misleading alerts and better explanations**, not automated accusations of market manipulation.

### 4) Solana verification & risk layer — *Can other apps check and act on our findings?*
For important findings, Thin Ice publishes a timestamped commitment (hash and relevant risk metadata) on **Solana devnet**, alongside access to the underlying snapshot and calculation method.

Other applications can check that a published assessment comes from an authorized source, is recent enough, and meets their risk policy. A demo smart contract could **pause an action that relies on a thin or inconsistent market**.

**Limit:** A blockchain receipt shows what was committed and when; it does *not* automatically prove Gemini supplied complete or authentic source data. We must expose our trust assumptions and preserve the supporting evidence.

## 6. Complete example workflow

**Illustrative scenario:** Gemini displays BTC above $100K at 70% and BTC above $150K at 85%, seemingly for the same year-end settlement.

1. **Collect:** Our backend retrieves both contracts and live order books from Gemini.
2. **Check the math:** The consistency engine spots the apparent contradiction.
3. **Check if it is real:** It compares settlement details, timestamps, bid/ask prices, available sizes and fees. It does not assume that a displayed-price difference means guaranteed profit.
4. **Investigate:** Grok Bot examines contract rules, market history and relevant news, then produces a sourced report.
5. **Monitor:** Thin Ice watches whether the inconsistency persists or disappears.
6. **Verify:** For a significant confirmed finding, the system records the assessment commitment on Solana.
7. **Use:** A demonstration onchain application reads a recent authorized assessment and pauses an action if its predefined market-quality requirements fail.

No production trading or market manipulation is necessary for the demo.

## 7. How Thin Ice complements Gemini

| Gemini's liquidity rewards | Thin Ice |
|---|---|
| Pays makers to provide qualifying orders | Measures how much usable depth is actually available |
| Uses periodic reward snapshots | Studies how liquidity persists or disappears over time |
| Incentivizes tighter, larger two-sided quotes | Measures resulting slippage and price fragility |
| Rewards makers under published rules | Checks mathematical coherence across related contracts |
| Operates the market | Explains anomalies and offers evidence users/apps can inspect |

**Simple analogy:** Gemini pays suppliers to stock the shelves. Thin Ice checks whether the shelves stay stocked, whether the posted prices make sense, and alerts people when something needs investigation.

## 8. What is new compared with the original Thin Ice file?
The original proposal already included Gemini order-book collection, a 10¢ price-move metric, A–F liquidity grades, historical charts, Solana receipts, an optional onchain consumer, and Grok Bot MCP/webhook basics.

**Our major extensions:**

1. **Mathematical consistency analysis across related contracts** (the largest new technical feature).
2. **Execution-aware validation** to avoid false claims from stale or untradeable prices.
3. **Liquidity resilience over time**, including stress periods and the effect of reward incentives.
4. **Autonomous Grok Bot incident investigations with follow-up**, beyond basic market lookups and alert summaries.
5. **Richer, policy-readable Solana assessments**, rather than receipts for a single liquidity grade alone.

## 9. What we can truthfully claim today vs. what needs testing

**Supported starting points:** Thin liquidity is a documented prediction-market problem; logical inconsistencies have been studied; Gemini publishes a real liquidity rewards program; an order-book/risk-monitoring product is technically plausible.

**Not yet established by our own live measurements:**

- The uploaded research's reported **$27 median** as a reliable current Gemini-wide cost-to-move figure. Its calculation needs validation, especially for order-book exhaustion.
- Whether rewarded Gemini markets systematically lose liquidity between snapshots.
- How frequently Gemini has verified, executable contradictions between comparable live contracts.
- Whether Grok Bot materially reduces false alerts versus a deterministic rules-only investigation.
- Whether real DeFi customers currently need this specific risk signal.

We should **not** claim that rewards are ineffective, that makers are manipulating markets, or that a Thin Ice grade predicts whether an event will occur.

## 10. Efficient hackathon scope

**Must have:**
1. Live Gemini market collector plus a stored snapshot history.
2. Reliable liquidity/depth/slippage calculation with clear handling of empty or exhausted books.
3. A small, verified market-relationship graph and mathematical consistency checker.
4. Correct validation of at least one anomaly using synchronized executable prices—or a clearly labeled synthetic replay if no live example exists.
5. Grok Bot investigation/report workflow for a detected event.
6. Solana receipt and a simple risk-policy demonstration.
7. A dashboard with a clear end-to-end story.

**Only if time remains:** Reward effectiveness comparisons, X-post handoffs, QuickNode indexing, richer optimization visualizations.

**Skip for now:** ElevenLabs, Ledger Flex integration, an AMM/DEX, automated production trading, and a reward-allocation optimizer that lacks real calibration data.

**Suggested demo story:** A market anomaly is detected → Thin Ice checks liquidity and mathematical rules → Grok Bot investigates → a reproducible report is published → an onchain consumer pauses an action based on a recent risky assessment.

## 11. A short pitch for teammates or judges

> Prediction-market odds are increasingly quoted as facts, even when a market has very little liquidity or related contracts show contradictory prices. Gemini is paying market makers to improve liquidity, but incentives alone don't tell users whether the resulting prices are stable or logically coherent. **Thin Ice** monitors live Gemini order books, validates mathematical relationships across contracts, and uses Grok Bot to investigate unusual findings. It then publishes verifiable assessments on Solana so other applications can apply risk checks before relying on those odds.

---

### References for implementation and validation
- Original uploaded source: *Thin Ice: deep dive* (November 16, 2026), including preliminary Gemini sample and proposed architecture.
- Gemini Liquidity Rewards Program: https://developer.gemini.com/prediction-markets/liquidity-rewards-program
- Gemini prediction-market APIs: https://developer.gemini.com/prediction-markets-spec
- Academic study of combinatorial arbitrage: https://arxiv.org/abs/2610.23517
- Existing analytics product for competitive comparison: https://oddpool.com/explore

*This is a project brief and proposed architecture, not a claim that all Gemini-specific hypotheses have already been independently validated.*
