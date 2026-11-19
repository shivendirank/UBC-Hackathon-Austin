import type { CheckStatus, Market, Relation } from "@/lib/api";
import { bookStatus } from "@/lib/status";

/**
 * Display rules on top of the existing formula. They do not change grades or receipts.
 * A book older than 30 minutes is not treated as a current assessment.
 * Healthy liquidity means grade A, B, or C in scoring.py: a large share of this market's
 * own visible depth sits in the 10¢ move window (and the book does not run out first).
 */
export const BOOK_FRESH_S = 30 * 60;

export type VerdictKind = "healthy" | "fragile" | "inconsistent" | "insufficient";

export type Verdict = {
  kind: VerdictKind;
  title: string;
  reason: string;
  evidence: string[];
  action: string;
  href: string;
};

const TITLE: Record<VerdictKind, string> = {
  healthy: "Healthy liquidity",
  fragile: "Fragile price",
  inconsistent: "Inconsistent markets",
  insufficient: "Insufficient data",
};

export function bookIsFresh(updatedAt: number, now = Date.now() / 1000): boolean {
  return now - updatedAt <= BOOK_FRESH_S;
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

export function assess(market: Market, inconsistent = false): Verdict {
  const href = `/market/${encodeURIComponent(market.symbol)}`;
  const fresh = bookIsFresh(market.updated_at);
  const status = bookStatus(market);
  const observed = `Order book observed ${new Date(market.updated_at * 1000).toLocaleString()}.`;
  const trade = market.score.last_trade_ts
    ? `Last trade ${new Date(market.score.last_trade_ts * 1000).toLocaleString()}. That is not the book time.`
    : "No trade is on record for this contract.";

  if (!fresh || status === "Empty" || market.odds_pct == null) {
    const why = !fresh
      ? "This order book is more than 30 minutes old, so Thin Ice is not treating it as a current reading."
      : "There is no two-sided quote, so this percent is not a real price.";
    return {
      kind: "insufficient",
      title: TITLE.insufficient,
      reason: why,
      evidence: [observed, trade],
      action: "Understand this market",
      href,
    };
  }

  if (inconsistent) {
    return {
      kind: "inconsistent",
      title: TITLE.inconsistent,
      reason: "A verified group that includes this contract breaks its price rule. That is a pricing disagreement, not a claim about why it exists.",
      evidence: [observed, trade],
      action: "Compare related predictions",
      href: `/compare?symbol=${encodeURIComponent(market.symbol)}`,
    };
  }

  const healthy = status === "OK" && (market.grade === "A" || market.grade === "B" || market.grade === "C");
  if (healthy) {
    return {
      kind: "healthy",
      title: TITLE.healthy,
      reason: "A large share of this market's own visible depth sits inside a 10¢ move, so the displayed price is relatively hard to shove with the size that is on the book. That is Thin Ice's current bar for healthy liquidity. It is not a forecast.",
      evidence: [observed, trade, `Spread ${market.spread_c ?? "—"}¢.`],
      action: "Understand this market",
      href,
    };
  }

  const ranOut = status === "Runs out";
  const depthPct = market.score.depth_pct;
  const depthBit =
    depthPct != null ? ` About ${Math.round(depthPct)}% of the cheaper side sits in that 10¢ window.` : "";
  return {
    kind: "fragile",
    title: TITLE.fragile,
    reason: ranOut
      ? "Few orders are available near the current price. The visible book runs out before the odds can move 10¢, so a larger trade can change the price you actually get."
      : `Relative to this market's own book, too little depth sits behind a 10¢ move, or the spread is wide.${depthBit} That is below Thin Ice's current bar for healthy liquidity.`,
    evidence: [observed, trade, `Spread ${market.spread_c ?? "—"}¢.`],
    action: "Understand this market",
    href,
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
