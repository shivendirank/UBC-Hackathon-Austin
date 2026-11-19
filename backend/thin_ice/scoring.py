"""Thin Ice scoring: how hard is it to move a market's odds by 10 cents?

Grades are relative to each book: what share of that side's visible depth do you need
to consume to push YES 10¢. Fixed dollar cutoffs are not used — a $40 book and a
$40,000 book are judged on their own depth shape.

Change FORMULA_VERSION whenever the math or the grade table changes.

Gemini prediction books are the YES side: bids buy YES, asks sell YES. Prices are in dollars
(0.01 to 0.99), amounts in contracts. All price math is done in integer cents to avoid float drift.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Iterable, Optional

FORMULA_VERSION = "2"
DELTA_CENTS = 10  # "cost to move 10 cents"
STALE_AFTER_S = 24 * 3600

GRADES = ["A", "B", "C", "D", "F"]
# Relative grade: share of this side's visible notional that sits inside the 10¢ move
# window, gated by how many contracts that window actually holds.
# (min depth_pct, min contracts in window, grade). A also needs spread <= 3¢ and not exhausted.
DEPTH_THRESHOLDS = [
    (80.0, 500.0, "A"),
    (55.0, 150.0, "B"),
    (35.0, 50.0, "C"),
    (15.0, 25.0, "D"),
]
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


def side_notional_usd(levels: list[Level], *, side: str) -> float:
    """Total visible USD on one side. asks: buy YES; bids: sell YES (= buy NO)."""
    if side == "ask":
        return sum(amount * price_c / 100 for price_c, amount in levels)
    return sum(amount * (100 - price_c) / 100 for price_c, amount in levels)


def contracts_in_move_window(levels: list[Level], *, side: str) -> float:
    """Contracts consumed walking the 10¢ move (or the whole side if it runs out)."""
    if not levels:
        return 0.0
    if side == "ask":
        rows = sorted(levels)
        target = rows[0][0] + DELTA_CENTS
        total = 0.0
        for price_c, amount in rows:
            if price_c >= target:
                return total
            total += amount
        return total
    rows = sorted(levels, reverse=True)
    target = rows[0][0] - DELTA_CENTS
    total = 0.0
    for price_c, amount in rows:
        if price_c <= target:
            return total
        total += amount
    return total


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
    depth_pct: Optional[float] = None  # % of cheaper side notional inside the 10¢ window
    reasons: list[str] = field(default_factory=list)
    formula_version: str = FORMULA_VERSION

    def to_dict(self) -> dict:
        return asdict(self)


def _drop(grade: str, steps: int = 1) -> str:
    return GRADES[min(GRADES.index(grade) + steps, len(GRADES) - 1)]


def _cap(grade: str, worst_allowed: str) -> str:
    return grade if GRADES.index(grade) >= GRADES.index(worst_allowed) else worst_allowed


def _grade_from_depth(depth_pct: float, window_contracts: float) -> str:
    grade = "F"
    for min_pct, min_contracts, g in DEPTH_THRESHOLDS:
        if depth_pct >= min_pct and window_contracts >= min_contracts:
            grade = g
            break
    return grade


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
            None, [f"one-sided book ({side})"],
        )

    best_bid, best_ask = max(p for p, _ in bids), min(p for p, _ in asks)
    spread = best_ask - best_bid
    up, up_ex = cost_up(asks)
    down, down_ex = cost_down(bids)
    if up <= down:
        move_cost, direction, exhausted = up, "up", up_ex
        side_levels, side_name = asks, "ask"
    else:
        move_cost, direction, exhausted = down, "down", down_ex
        side_levels, side_name = bids, "bid"

    side_total = side_notional_usd(side_levels, side=side_name)
    window_contracts = contracts_in_move_window(side_levels, side=side_name)
    depth_pct = round(100.0 * move_cost / side_total, 2) if side_total > 0 else 0.0

    if exhausted:
        reasons.append(f"book runs out before a 10-cent move ({direction})")

    # Relative grade: % of this side inside the 10¢ window, with a contract floor per letter.
    grade = _grade_from_depth(depth_pct, window_contracts)
    if exhausted:
        # Surviving a 10¢ move matters. An exhausted book cannot be A–C.
        grade = _cap(grade, "D")
        if window_contracts < DEPTH_THRESHOLDS[-1][1]:
            grade = "F"

    if grade == "A" and spread > A_MAX_SPREAD_C:
        grade = "B"
        reasons.append(f"The buy and sell quotes are {spread}¢ apart.")
    if grade == "F":
        reasons.append(
            f"10¢ move sits in {depth_pct:.0f}% of visible {direction}-side depth "
            f"({window_contracts:.0f} contracts) — below this market's depth bar"
        )

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
        depth_pct=depth_pct,
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
