"""Mathematical consistency engine (spec component 2).

1. A small relationship graph between contracts (`Relation`):
   - threshold_ladder: "$64,500 or above", "$64,600 or above", ... in ONE event. P must not rise
     as the threshold rises. Same event = same settlement, so these are auto-verified.
   - time_ladder: "Before Mar 1", "Before Jul 1", ... in one event. An earlier deadline can't be
     more likely than a later one. Auto-verified when every label parses.
   - exclusive: at most one outcome can happen, so P must sum to <= 100%.
   - exclusive_exhaustive: exactly one happens, so P should sum to 100%.
   Exclusivity is NOT inferred from Gemini's "categorical" type: some categorical events are ladders
   or multi-select ("Who will leave ... in 2026?"). Suggested exclusive relations start unverified;
   a person flips `verified` in relations.json after reading the rules.

2. Theoretical check on mid prices, plus the nearest coherent prices (isotonic regression for
   ladders, Euclidean projection onto the simplex for exclusive sets). `gap_c` = total cents of
   adjustment needed, a size-free measure of how incoherent the quotes are.

3. Execution-aware validation: is the contradiction tradeable at real bid/ask prices, in what size,
   after fees, with books recorded close enough together in time? Displayed contradictions are
   not assumed to be arbitrage.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from . import config
from .scoring import Level, parse_levels

KINDS = ("threshold_ladder", "time_ladder", "exclusive", "exclusive_exhaustive")
STATUSES = ("coherent", "theoretical_only", "executable", "stale", "insufficient_data")


@dataclass
class Relation:
    id: str
    kind: str
    # Ladders: ordered MOST likely first (lowest threshold / latest deadline first);
    # constraint p[0] >= p[1] >= ... Exclusive sets: any order.
    members: list[str]
    source: str = "manual"  # "auto_same_event" | "suggested" | "manual"
    verified: bool = False
    event_ticker: Optional[str] = None
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# ---------- discovery ----------

_MONEY = r"\$?\s*([\d][\d,]*(?:\.\d+)?)\s*([kKmMbB])?"
_ABOVE = re.compile(_MONEY + r"\s*(?:or above|or more|\+|and above)", re.I)
_BELOW = re.compile(_MONEY + r"\s*(?:or below|or less|and below)", re.I)
_BEFORE = re.compile(r"^\s*(?:before|by)\s+(.+?)\??\s*$", re.I)
_SINGLE_WINNER = re.compile(r"\b(winner|nominee|who will win|next prime minister|next president)\b", re.I)


def _money(num: str, suffix: Optional[str]) -> float:
    v = float(num.replace(",", ""))
    return v * {"k": 1e3, "m": 1e6, "b": 1e9}.get((suffix or "").lower(), 1)


def _deadline(text: str) -> Optional[datetime]:
    t = text.strip().rstrip("?").strip()
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y", "%B %Y", "%b %Y", "%Y"):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    return None


def suggest_relations(events: Iterable[dict]) -> list[Relation]:
    """Propose relations from Gemini events (open contracts only)."""
    out: list[Relation] = []
    for e in events:
        cs = [c for c in e.get("contracts", []) if c.get("marketState") == "open" and c.get("instrumentSymbol")]
        if len(cs) < 2:
            continue
        ticker = e.get("ticker") or e.get("id")
        above, below, before = [], [], []
        for c in cs:
            label = c.get("label") or ""
            if m := _ABOVE.search(label):
                above.append((_money(*m.groups()), c["instrumentSymbol"]))
            elif m := _BELOW.search(label):
                below.append((_money(*m.groups()), c["instrumentSymbol"]))
            elif (m := _BEFORE.match(label)) and (d := _deadline(m.group(1))):
                before.append((d, c["instrumentSymbol"]))
        if len(above) >= 2:  # lower threshold is more likely
            out.append(Relation(f"ladder:{ticker}:above", "threshold_ladder",
                                [s for _, s in sorted(above)], "auto_same_event", True, ticker,
                                "Same event, same settlement: higher threshold can't be more likely."))
        if len(below) >= 2:  # higher threshold is more likely
            out.append(Relation(f"ladder:{ticker}:below", "threshold_ladder",
                                [s for _, s in sorted(below, reverse=True)], "auto_same_event", True, ticker,
                                "Same event: lower 'or below' threshold can't be more likely."))
        if len(before) >= 2 and len(before) == len(cs):  # later deadline is more likely
            out.append(Relation(f"time:{ticker}", "time_ladder",
                                [s for _, s in sorted(before, reverse=True)], "auto_same_event", True, ticker,
                                "Same event: an earlier deadline can't be more likely than a later one."))
        if not (above or below or before) and _SINGLE_WINNER.search(e.get("title") or ""):
            out.append(Relation(f"excl:{ticker}", "exclusive", [c["instrumentSymbol"] for c in cs],
                                "suggested", False, ticker,
                                "Looks single-winner from the title. Verify the rules before trusting."))
    return out


def load_manual(path: Optional[Path] = None) -> list[Relation]:
    """backend/relations.json: [{"id","kind","members","verified","note"}]. Manual entries win."""
    path = Path(path or config.RELATIONS_PATH)
    if not path.exists():
        return []
    return [Relation(**{**r, "source": "manual"}) for r in json.loads(path.read_text())]


# ---------- optimization: nearest coherent prices ----------

def isotonic_nonincreasing(values: list[float]) -> list[float]:
    """Pool-adjacent-violators: closest (least squares) non-increasing sequence."""
    blocks: list[list[float]] = []  # [sum, count]
    for v in values:
        blocks.append([v, 1])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] < blocks[-1][0] / blocks[-1][1]:
            s, n = blocks.pop()
            blocks[-1][0] += s
            blocks[-1][1] += n
    out: list[float] = []
    for s, n in blocks:
        out.extend([s / n] * n)
    return out


def project_simplex(values: list[float], total: float, *, inequality: bool) -> list[float]:
    """Closest point with p >= 0 and sum == total (or <= total if inequality)."""
    if inequality and sum(max(0.0, v) for v in values) <= total:
        return [max(0.0, v) for v in values]
    u = sorted(values, reverse=True)
    css, theta = 0.0, 0.0
    for i, ui in enumerate(u, 1):
        css += ui
        t = (css - total) / i
        if ui - t > 0:
            theta = t
    return [max(0.0, v - theta) for v in values]


# ---------- checks ----------

@dataclass
class Book:
    symbol: str
    ts: int
    bids: list[Level]
    asks: list[Level]

    @property
    def mid(self) -> Optional[float]:
        if not self.bids or not self.asks:
            return None
        return (max(p for p, _ in self.bids) + min(p for p, _ in self.asks)) / 2


def book_from(symbol: str, ts: int, bids_raw, asks_raw) -> Book:
    return Book(symbol, ts, parse_levels(bids_raw), parse_levels(asks_raw))


@dataclass
class CheckResult:
    relation_id: str
    kind: str
    verified: bool
    ts: int
    status: str
    summary: str
    prices_c: dict = field(default_factory=dict)  # symbol -> mid (None if one-sided)
    coherent_c: dict = field(default_factory=dict)  # symbol -> nearest coherent price
    gap_c: float = 0.0
    violations: list = field(default_factory=list)  # theoretical, on mids
    opportunities: list = field(default_factory=list)  # executable, at bid/ask with size
    max_skew_s: int = 0
    excluded: list = field(default_factory=list)  # members without a two-sided book

    def to_dict(self) -> dict:
        return asdict(self)


def _walk_pair(sell_bids: list[Level], buy_asks: list[Level], min_edge_c: float) -> tuple[float, float]:
    """Sell into `sell_bids` and buy from `buy_asks` while bid - ask > min_edge. Returns (qty, profit $)."""
    bids = [list(x) for x in sorted(sell_bids, reverse=True)]
    asks = [list(x) for x in sorted(buy_asks)]
    i = j = 0
    qty = profit = 0.0
    while i < len(bids) and j < len(asks) and bids[i][0] - asks[j][0] > min_edge_c:
        take = min(bids[i][1], asks[j][1])
        qty += take
        profit += take * (bids[i][0] - asks[j][0] - min_edge_c) / 100
        bids[i][1] -= take
        asks[j][1] -= take
        if bids[i][1] <= 1e-12:
            i += 1
        if asks[j][1] <= 1e-12:
            j += 1
    return qty, profit


def check(relation: Relation, books: dict[str, Book], *, now: int,
          fee_c: float = None, sync_tolerance_s: int = None) -> CheckResult:
    fee_c = config.FEE_CENTS_PER_CONTRACT if fee_c is None else fee_c
    sync_tolerance_s = config.SYNC_TOLERANCE_S if sync_tolerance_s is None else sync_tolerance_s
    present = [books[s] for s in relation.members if s in books]
    res = CheckResult(relation.id, relation.kind, relation.verified, now, "insufficient_data", "")
    res.prices_c = {b.symbol: b.mid for b in present}
    res.excluded = [s for s in relation.members if s not in books or books[s].mid is None]
    priced = [b for b in present if b.mid is not None]
    if len(priced) < 2:
        res.summary = "Not enough two-sided books to check this relationship."
        return res
    res.max_skew_s = max(b.ts for b in present) - min(b.ts for b in present)

    if relation.kind in ("threshold_ladder", "time_ladder"):
        mids = [b.mid for b in priced]
        proj = isotonic_nonincreasing(mids)
        for a_i, a in enumerate(priced):
            for b in priced[a_i + 1:]:
                if b.mid > a.mid:  # less-likely contract priced above more-likely one
                    res.violations.append({"more_likely": a.symbol, "less_likely": b.symbol,
                                           "more_likely_c": a.mid, "less_likely_c": b.mid,
                                           "excess_c": b.mid - a.mid})
        # executable: sell the less-likely YES at its bid, buy the more-likely YES at its ask.
        # Payoff is never negative (if the less-likely event happens, so does the more-likely one).
        for a_i, a in enumerate(present):
            for b in present[a_i + 1:]:
                qty, profit = _walk_pair(b.bids, a.asks, 2 * fee_c)
                if qty > 0:
                    res.opportunities.append({"sell": b.symbol, "buy": a.symbol, "contracts": round(qty, 4),
                                              "locked_profit_usd": round(profit, 2)})
    else:
        mids = [b.mid for b in priced]
        total = 100.0
        proj = project_simplex(mids, total, inequality=relation.kind == "exclusive")
        s = sum(mids)
        if s > total + 1e-9 or (relation.kind == "exclusive_exhaustive" and abs(s - total) > 1e-9):
            res.violations.append({"sum_c": round(s, 2), "expected": "<= 100" if relation.kind == "exclusive" else "= 100"})
        # executable over the WHOLE listed set only (a missing member breaks the hedge)
        if not res.excluded and len(present) == len(relation.members):
            best_bids = [max(b.bids) for b in present]  # (price, qty) at the top
            best_asks = [min(b.asks) for b in present]
            n = len(present)
            sell_edge = sum(p for p, _ in best_bids) - total - n * fee_c
            if sell_edge > 0:  # sell YES on all: at most one pays out
                res.opportunities.append({"action": "sell_all_yes", "edge_c_per_set": round(sell_edge, 2),
                                          "sets": min(q for _, q in best_bids)})
            if relation.kind == "exclusive_exhaustive":
                buy_edge = total - sum(p for p, _ in best_asks) - n * fee_c
                if buy_edge > 0:  # buy YES on all: exactly one pays out
                    res.opportunities.append({"action": "buy_all_yes", "edge_c_per_set": round(buy_edge, 2),
                                              "sets": min(q for _, q in best_asks)})

    res.coherent_c = {b.symbol: round(p, 3) for b, p in zip(priced, proj)}
    res.gap_c = round(sum(abs(b.mid - p) for b, p in zip(priced, proj)), 3)

    synced = res.max_skew_s <= sync_tolerance_s
    if not res.violations and not res.opportunities:
        res.status, res.summary = "coherent", "Related prices are consistent with each other."
    elif not synced:
        res.status = "stale"
        res.summary = (f"Prices look inconsistent, but the books were recorded {res.max_skew_s}s apart, "
                       "so this may be a timing artifact.")
    elif res.opportunities:
        res.status = "executable"
        res.summary = "The contradiction holds at executable bid/ask prices after fees, in the size shown."
    else:
        res.status = "theoretical_only"
        res.summary = ("These contracts appear inconsistent on displayed prices, but the executable quotes "
                       "are too thin or too wide to establish a tradeable discrepancy.")
    if not relation.verified:
        res.summary += " This relationship is suggested, not yet verified against the contract rules."
    return res
