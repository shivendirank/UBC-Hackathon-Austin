import type { CheckStatus, Market, Relation } from "@/lib/api";
import { bookStatus } from "@/lib/status";

/**
 * Display rules on top of the existing formula. They do not change grades or receipts.
 *
 * Freshness is separate from the liquidity reading:
 * - live / recent / aging → still show Fragile / Healthy / Inconsistent from the last book
 * - archived (or empty) → Insufficient data (no current reading worth trusting as current)
 *
 * Healthy liquidity means grade A, B, or C in scoring.py.
 */
export const BOOK_LIVE_S = 15 * 60;
export const BOOK_RECENT_S = 2 * 60 * 60;
export const BOOK_AGING_S = 24 * 60 * 60;

/** @deprecated use BOOK_LIVE_S / bookFreshness — kept so older imports keep working */
export const BOOK_FRESH_S = BOOK_LIVE_S;

export type FreshnessBand = "live" | "recent" | "aging" | "archived";

export type VerdictKind = "healthy" | "fragile" | "inconsistent" | "insufficient";

export type Verdict = {
  kind: VerdictKind;
  title: string;
  reason: string;
  evidence: string[];
  action: string;
  href: string;
  freshness: FreshnessBand;
  ageLabel: string;
};

const TITLE: Record<VerdictKind, string> = {
  healthy: "Healthy liquidity",
  fragile: "Fragile price",
  inconsistent: "Inconsistent markets",
  insufficient: "Insufficient data",
};

const AGE_CHIP: Record<FreshnessBand, string> = {
  live: "Live",
  recent: "Recent book",
  aging: "Older book",
  archived: "Archived book",
};

export function bookAgeSeconds(updatedAt: number, now = Date.now() / 1000): number {
  return Math.max(0, now - updatedAt);
}

export function bookFreshness(updatedAt: number, now = Date.now() / 1000): FreshnessBand {
  const age = bookAgeSeconds(updatedAt, now);
  if (age <= BOOK_LIVE_S) return "live";
  if (age <= BOOK_RECENT_S) return "recent";
  if (age <= BOOK_AGING_S) return "aging";
  return "archived";
}

/** True when the book is new enough to show the Live pulse. */
export function bookIsFresh(updatedAt: number, now = Date.now() / 1000): boolean {
  return bookFreshness(updatedAt, now) === "live";
}

/** Higher = prefer on the board (live first, archived last). */
export function freshnessRank(updatedAt: number, now = Date.now() / 1000): number {
  switch (bookFreshness(updatedAt, now)) {
    case "live":
      return 3;
    case "recent":
      return 2;
    case "aging":
      return 1;
    default:
      return 0;
  }
}

export function formatBookAge(updatedAt: number, now = Date.now() / 1000): string {
  const age = bookAgeSeconds(updatedAt, now);
  if (age < 60) return "just now";
  if (age < 3600) return `${Math.round(age / 60)} min ago`;
  if (age < 86400) {
    const h = Math.round(age / 3600);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  const d = Math.round(age / 86400);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function freshnessLabel(updatedAt: number, now = Date.now() / 1000): string {
  const band = bookFreshness(updatedAt, now);
  if (band === "live") return AGE_CHIP.live;
  return `${AGE_CHIP[band]} · ${formatBookAge(updatedAt, now)}`;
}

export function inconsistentSymbols(relations: Relation[]): Set<string> {
  const out = new Set<string>();
  for (const r of relations) {
    if (!r.verified) continue;
    const status = r.latest_check?.status;
    if (status === "executable" || status === "theoretical_only") {
      for (const symbol of r.members) out.add(symbol);
    }
  }
  return out;
}

/** Best verified relation that includes this symbol, preferring a broken check. */
export function relatedCheck(relations: Relation[], symbol: string): Relation | null {
  const hits = relations.filter((r) => r.verified && r.members.includes(symbol));
  if (hits.length === 0) return null;
  const broken = hits.find((r) => {
    const s = r.latest_check?.status;
    return s === "executable" || s === "theoretical_only";
  });
  return broken ?? hits[0];
}

function ageReason(band: FreshnessBand, ageText: string): string {
  if (band === "live") return "";
  if (band === "recent") {
    return ` The order book was recorded ${ageText}, so treat this as a recent reading — not a live tick.`;
  }
  if (band === "aging") {
    return ` The order book is ${ageText}. Depth and the percent can drift before the next refresh.`;
  }
  return ` The last order book is ${ageText}, so Thin Ice is not treating this as a current reading.`;
}

function liquidityVerdict(
  market: Market,
  inconsistent: boolean,
  status: ReturnType<typeof bookStatus>,
): { kind: Exclude<VerdictKind, "insufficient">; reason: string } {
  if (inconsistent) {
    return {
      kind: "inconsistent",
      reason:
        "A verified group that includes this contract breaks its price rule. That is a pricing disagreement, not a claim about why it exists.",
    };
  }

  const healthy = status === "OK" && (market.grade === "A" || market.grade === "B" || market.grade === "C");
  if (healthy) {
    return {
      kind: "healthy",
      reason:
        "A large share of this market's own visible depth sits inside a 10¢ move, so the displayed price is relatively hard to shove with the size that is on the book. That is Thin Ice's current bar for healthy liquidity. It is not a forecast.",
    };
  }

  const ranOut = status === "Runs out";
  const depthPct = market.score.depth_pct;
  const depthBit =
    depthPct != null ? ` About ${Math.round(depthPct)}% of the cheaper side sits in that 10¢ window.` : "";
  return {
    kind: "fragile",
    reason: ranOut
      ? "Few orders are available near the current price. The visible book runs out before the odds can move 10¢, so a larger trade can change the price you actually get."
      : `Relative to this market's own book, too little depth sits behind a 10¢ move, or the spread is wide.${depthBit} That is below Thin Ice's current bar for healthy liquidity.`,
  };
}

export function assess(market: Market, inconsistent = false): Verdict {
  const href = `/market/${encodeURIComponent(market.symbol)}`;
  const freshness = bookFreshness(market.updated_at);
  const ageLabel = freshnessLabel(market.updated_at);
  const ageText = formatBookAge(market.updated_at);
  const status = bookStatus(market);
  const observed = `Order book observed ${new Date(market.updated_at * 1000).toLocaleString()} (${ageText}).`;
  const trade = market.score.last_trade_ts
    ? `Last trade ${new Date(market.score.last_trade_ts * 1000).toLocaleString()}. That is not the book time.`
    : "No trade is on record for this contract.";

  const empty = status === "Empty" || market.odds_pct == null;

  // Only archive / empty books lose the liquidity reading entirely.
  if (empty || freshness === "archived") {
    const why = empty
      ? "There is no two-sided quote, so this percent is not a real price."
      : `This order book is ${ageText}, so Thin Ice is not treating it as a current reading. Start or wait for the recorder to refresh it.`;
    return {
      kind: "insufficient",
      title: TITLE.insufficient,
      reason: why,
      evidence: [observed, trade],
      action: "Understand this market",
      href,
      freshness,
      ageLabel,
    };
  }

  const liq = liquidityVerdict(market, inconsistent, status);
  const ageNote = ageReason(freshness, ageText);
  return {
    kind: liq.kind,
    title: TITLE[liq.kind],
    reason: `${liq.reason}${ageNote}`,
    evidence: [observed, trade, `Spread ${market.spread_c ?? "—"}¢.`, `Book age: ${ageLabel}.`],
    action: liq.kind === "inconsistent" ? "Compare related predictions" : "Understand this market",
    href: liq.kind === "inconsistent" ? `/compare?symbol=${encodeURIComponent(market.symbol)}` : href,
    freshness,
    ageLabel,
  };
}

export function relationStory(kind: string, status: CheckStatus | undefined, verified: boolean): { title: string; body: string } {
  if (!verified) {
    return {
      title: "Possible relationship",
      body: "Thin Ice has not confirmed the settlement rules for this group. Prices are shown together, but a disagreement here is not a confirmed inconsistency.",
    };
  }
  if (!status) {
    return {
      title: "Not checked yet",
      body: "These contracts are a verified group, and the latest books have not been compared yet.",
    };
  }
  if (kind === "threshold_ladder" && status === "coherent") {
    return {
      title: "These markets follow the expected probability ordering.",
      body: "A higher threshold is harder to reach, so it should not be more likely than a lower threshold when both contracts settle the same event at the same time.",
    };
  }
  if (kind === "time_ladder" && status === "coherent") {
    return {
      title: "These deadlines follow the expected ordering.",
      body: "An earlier deadline should not be more likely than a later one when both contracts are the same event.",
    };
  }
  if (status === "coherent") {
    return {
      title: "No ordering violations found among these verified relationships.",
      body: "The latest prices agree with the rule for this group.",
    };
  }
  if (status === "theoretical_only") {
    return {
      title: "The displayed percents disagree.",
      body: "The mids break the rule for this group. The bid and ask, in the available size and after fees, are not far enough apart to treat that as a trade.",
    };
  }
  if (status === "executable") {
    return {
      title: "The quotes disagree.",
      body: "Bid, ask, size, and fees leave a gap on this verified rule. That is a pricing disagreement. It is not evidence of intent.",
    };
  }
  if (status === "stale") {
    return {
      title: "These books are too far apart in time.",
      body: "Thin Ice will not call a contradiction when the order books were recorded more than two minutes apart.",
    };
  }
  return {
    title: "Not enough data to compare these contracts.",
    body: "A price is missing, or the group does not have a complete fresh reading.",
  };
}
