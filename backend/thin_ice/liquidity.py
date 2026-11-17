"""Liquidity & resilience engine (spec component 1).

Per book: execution price and slippage for set trade sizes, depth near the top, and whether the
visible book runs out first. Over time (from the grades table): how long a market stays thin, and
whether depth drops around fast price moves.

Pure functions; the same snapshot always gives the same numbers.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterable, Optional

from .scoring import Level, parse_levels

TRADE_SIZES_USD = (100, 500, 1_000, 5_000)
DEPTH_BANDS_C = (5, 10)
THIN_USD = 100  # moveCost under this = "thin" (grade F line)


@dataclass
class Fill:
    side: str  # "buy_yes" (walk asks) | "sell_yes" (walk bids)
    target_usd: float
    filled_usd: float
    contracts: float
    avg_price_c: Optional[float]
    worst_price_c: Optional[int]
    slippage_c: Optional[float]  # avg price vs best price, in cents (always >= 0)
    complete: bool  # False = visible book ran out first

    def to_dict(self) -> dict:
        return asdict(self)


def simulate_fill(levels: list[Level], side: str, usd: float) -> Fill:
    """Walk the book spending `usd` of collateral.

    buy_yes: pay `price` per contract on asks. sell_yes: equivalent to buying NO, so collateral
    per contract is (1 - price); walk bids from the top down.
    """
    book = sorted(levels) if side == "buy_yes" else sorted(levels, reverse=True)
    if not book:
        return Fill(side, usd, 0.0, 0.0, None, None, None, False)
    best = book[0][0]
    spent, qty, notional_c, worst = 0.0, 0.0, 0.0, best
    for price_c, amount in book:
        per = (price_c if side == "buy_yes" else 100 - price_c) / 100
        if per <= 0:
            continue
        take = min(amount, (usd - spent) / per)
        if take <= 0:
            break
        spent += take * per
        qty += take
        notional_c += take * price_c
        worst = price_c
        if spent >= usd - 1e-9:
            break
    avg = notional_c / qty if qty else None
    slip = None if avg is None else (avg - best if side == "buy_yes" else best - avg)
    return Fill(side, usd, round(spent, 2), round(qty, 4), None if avg is None else round(avg, 3),
                worst, None if slip is None else round(slip, 3), spent >= usd - 1e-6)


def depth_within(levels: list[Level], side: str, band_c: int) -> float:
    """Collateral (USD) resting within `band_c` cents of the best price on one side."""
    if not levels:
        return 0.0
    if side == "asks":
        best = min(p for p, _ in levels)
        return round(sum(a * p / 100 for p, a in levels if p - best <= band_c), 2)
    best = max(p for p, _ in levels)
    return round(sum(a * (100 - p) / 100 for p, a in levels if best - p <= band_c), 2)


def book_report(bids_raw: Iterable[dict], asks_raw: Iterable[dict],
                sizes: Iterable[float] = TRADE_SIZES_USD) -> dict:
    """Everything the market page shows under "How strong is this market?"."""
    bids, asks = parse_levels(bids_raw), parse_levels(asks_raw)
    fills = []
    for usd in sizes:
        fills.append(simulate_fill(asks, "buy_yes", usd).to_dict())
        fills.append(simulate_fill(bids, "sell_yes", usd).to_dict())
    return {
        "fills": fills,
        "depth": {f"{side}_{b}c": depth_within(lv, side, b)
                  for side, lv in (("bids", bids), ("asks", asks)) for b in DEPTH_BANDS_C},
        "levels": {"bids": len(bids), "asks": len(asks)},
        "summary": _summary(fills),
    }


def _summary(fills: list[dict]) -> str:
    """One plain sentence, e.g. 'A $500 buy would fill at 7.5 cents worse than the quote.'"""
    for f in fills:
        if not f["complete"]:
            verb = "buy" if f["side"] == "buy_yes" else "sell"
            return f"A ${f['target_usd']:,.0f} {verb} would run out of visible orders."
        if f["slippage_c"] is not None and f["slippage_c"] >= 2:
            verb = "buy" if f["side"] == "buy_yes" else "sell"
            return (f"A ${f['target_usd']:,.0f} {verb} would fill {f['slippage_c']:.1f} cents "
                    "worse than the quoted price.")
    return "Trades up to $5,000 fill within 2 cents of the quoted price."


# ---------- resilience over time ----------

def resilience(history: list[dict], *, jump_c: int = 5) -> dict:
    """history: grades rows ordered by ts: {ts, move_cost_usd, best_bid_c, best_ask_c}.

    - share_thin: fraction of observed time with moveCost < $100 (time-weighted, not sample-counted)
    - longest_thin_s: longest continuous thin stretch
    - around_moves: for each mid jump >= jump_c cents between samples, depth before vs after
    """
    if len(history) < 2:
        return {"samples": len(history), "share_thin": None, "longest_thin_s": None, "around_moves": []}
    thin_s = total_s = streak = longest = 0
    moves = []
    for a, b in zip(history, history[1:]):
        dt = max(0, b["ts"] - a["ts"])
        total_s += dt
        if (a["move_cost_usd"] or 0) < THIN_USD:
            thin_s += dt
            streak += dt
            longest = max(longest, streak)
        else:
            streak = 0
        ma, mb = _mid(a), _mid(b)
        if ma is not None and mb is not None and abs(mb - ma) >= jump_c:
            moves.append({"ts": b["ts"], "from_c": ma, "to_c": mb,
                          "move_cost_before": a["move_cost_usd"], "move_cost_after": b["move_cost_usd"]})
    return {
        "samples": len(history),
        "observed_s": total_s,
        "share_thin": round(thin_s / total_s, 3) if total_s else None,
        "longest_thin_s": longest,
        "around_moves": moves[-10:],
    }


def _mid(row: dict) -> Optional[float]:
    if row.get("best_bid_c") is None or row.get("best_ask_c") is None:
        return None
    return (row["best_bid_c"] + row["best_ask_c"]) / 2
