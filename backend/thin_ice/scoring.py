"""Thin Ice scoring: how many dollars it takes to move a market's odds by 10 cents.

This file is the open formula. Anyone can re-run it on a pinned snapshot and get the same grade
(see `verify.py`). Change FORMULA_VERSION whenever the math or the grade table changes.

Gemini prediction books are the YES side: bids buy YES, asks sell YES. Prices are in dollars
(0.01 to 0.99), amounts in contracts. All price math is done in integer cents to avoid float drift.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Iterable, Optional

FORMULA_VERSION = "1"
DELTA_CENTS = 10  # "cost to move 10 cents"
STALE_AFTER_S = 24 * 3600

GRADES = ["A", "B", "C", "D", "F"]
# (minimum move cost in USD, grade). A also needs spread <= 3 cents.
THRESHOLDS = [(10_000, "A"), (2_500, "B"), (1_000, "C"), (100, "D")]
A_MAX_SPREAD_C = 3
CAP_D_SPREAD_C = 10
F_SPREAD_C = 20

Level = tuple[int, float]  # (price in cents, amount in contracts)


def parse_levels(raw: Iterable[dict]) -> list[Level]:
    """Gemini levels look like {"price": "0.42", "amount": "120.0", "timestamp": "..."}."""
    return [(round(float(lv["price"]) * 100), float(lv["amount"])) for lv in raw]


def cost_up(asks: list[Level]) -> tuple[float, bool]:
    """USD to push YES up 10 cents: buy every ask priced below bestAsk + 10 cents.

    Returns (cost, exhausted). exhausted=True means the book ran out first, so the
    cost is the whole side and the true move is even cheaper than "10 cents for $cost".
    """
    asks = sorted(asks)
    if not asks:
        return 0.0, True
    target = asks[0][0] + DELTA_CENTS
    cost = 0.0
    for price_c, amount in asks:
        if price_c >= target:
            return cost, False
        cost += amount * price_c / 100
    return cost, True


def cost_down(bids: list[Level]) -> tuple[float, bool]:
    """USD to push YES down 10 cents: sell YES into every bid above bestBid - 10 cents.

    Selling YES at p is the same exposure as buying NO at (1 - p), so each level costs
    amount * (1 - p).
    """
    bids = sorted(bids, reverse=True)
    if not bids:
        return 0.0, True
    target = bids[0][0] - DELTA_CENTS
    cost = 0.0
    for price_c, amount in bids:
        if price_c <= target:
            return cost, False
        cost += amount * (100 - price_c) / 100
    return cost, True


@dataclass
class Score:
    symbol: str
    ts: int
    grade: str
    best_bid_c: Optional[int]
    best_ask_c: Optional[int]
    mid_c: Optional[float]
    spread_c: Optional[int]
    cost_up_usd: float
    cost_down_usd: float
    move_cost_usd: float
    cheaper_direction: Optional[str]  # "up" | "down"
    exhausted: bool
    last_trade_ts: Optional[int]
    spoof_cost_usd: Optional[float]
    reasons: list[str] = field(default_factory=list)
    formula_version: str = FORMULA_VERSION

    def to_dict(self) -> dict:
        return asdict(self)


def _drop(grade: str, steps: int = 1) -> str:
    return GRADES[min(GRADES.index(grade) + steps, len(GRADES) - 1)]


def _cap(grade: str, worst_allowed: str) -> str:
    return grade if GRADES.index(grade) >= GRADES.index(worst_allowed) else worst_allowed


def score_book(
    symbol: str,
    bids_raw: Iterable[dict],
    asks_raw: Iterable[dict],
    *,
    now: int,
    last_trade_ts: Optional[int] = None,
    quantity_minimum: float = 1.0,
) -> Score:
    """Grade one contract from its order book. Pure function: same inputs, same grade."""
    bids, asks = parse_levels(bids_raw), parse_levels(asks_raw)
    reasons: list[str] = []

    if not bids or not asks:
        side = "empty book" if not bids and not asks else ("no bids" if not bids else "no asks")
        up, up_ex = cost_up(asks)
        down, down_ex = cost_down(bids)
        return Score(
            symbol, now, "F",
            max(p for p, _ in bids) if bids else None,
            min(p for p, _ in asks) if asks else None,
            None, None, up, down, 0.0, None, True, last_trade_ts, None,
            [f"one-sided book ({side})"],
        )

    best_bid, best_ask = max(p for p, _ in bids), min(p for p, _ in asks)
    spread = best_ask - best_bid
    up, up_ex = cost_up(asks)
    down, down_ex = cost_down(bids)
    if up <= down:
        move_cost, direction, exhausted = up, "up", up_ex
    else:
        move_cost, direction, exhausted = down, "down", down_ex
    if exhausted:
        reasons.append(f"book runs out before a 10-cent move ({direction})")

    grade = "F"
    for minimum, g in THRESHOLDS:
        if move_cost >= minimum:
            grade = g
            break
    if grade == "A" and spread > A_MAX_SPREAD_C:
        grade = "B"
        reasons.append(f"The buy and sell quotes are {spread}¢ apart.")
    if grade == "F":
        reasons.append(f"moves 10 cents for ${move_cost:,.2f} (under $100)")

    stale = last_trade_ts is None or now - last_trade_ts > STALE_AFTER_S
    if stale and grade != "F":
        grade = _drop(grade)
        reasons.append("No trade in the last 24 hours." if last_trade_ts else "No trades have been recorded for this contract yet.")
    if spread > CAP_D_SPREAD_C:
        capped = _cap(grade, "D")
        if capped != grade:
            reasons.append(f"The buy and sell quotes are {spread}¢ apart.")
        grade = capped
    if spread > F_SPREAD_C:
        grade = "F"
        reasons.append(f"The buy and sell quotes are {spread}¢ apart, which is wider than 20¢.")

    return Score(
        symbol=symbol,
        ts=now,
        grade=grade,
        best_bid_c=best_bid,
        best_ask_c=best_ask,
        mid_c=(best_bid + best_ask) / 2,
        spread_c=spread,
        cost_up_usd=round(up, 2),
        cost_down_usd=round(down, 2),
        move_cost_usd=round(move_cost, 2),
        cheaper_direction=direction,
        exhausted=exhausted,
        last_trade_ts=last_trade_ts,
        # One minimum-size fill at the best ask can set the "last traded" price.
        # [verify] how Gemini's own UI picks the displayed price before claiming this on stage.
        spoof_cost_usd=round(quantity_minimum * best_ask / 100, 2),
        reasons=reasons,
    )


def event_grade(scores: list[Score]) -> Optional[Score]:
    """A categorical event is graded by its headline contract: the favorite (highest mid)."""
    priced = [s for s in scores if s.mid_c is not None]
    if not priced:
        return scores[0] if scores else None
    return max(priced, key=lambda s: s.mid_c or 0)


def unusual_move(
    trades: list[dict],
    move_cost_usd: float,
    *,
    window_s: int = 600,
    min_move_c: int = 10,
    max_move_cost_usd: float = 500,
) -> Optional[dict]:
    """Flag a >=10-cent move within 10 minutes on a book that cost under $500 to move.

    Wording rule: this is an "unusual move on a thin book", never an accusation.
    trades: Gemini /v1/trades rows ({"timestamp", "price", ...}), any order.
    """
    if move_cost_usd >= max_move_cost_usd or len(trades) < 2:
        return None
    rows = sorted((int(t["timestamp"]), round(float(t["price"]) * 100)) for t in trades)
    start = 0
    for end in range(len(rows)):
        while rows[end][0] - rows[start][0] > window_s:
            start += 1
        window = rows[start : end + 1]
        lo, hi = min(p for _, p in window), max(p for _, p in window)
        if hi - lo >= min_move_c:
            return {
                "from_ts": window[0][0],
                "to_ts": window[-1][0],
                "low_c": lo,
                "high_c": hi,
                "move_c": hi - lo,
                "move_cost_usd": move_cost_usd,
                "label": "Unusual move on a thin book",
            }
    return None
