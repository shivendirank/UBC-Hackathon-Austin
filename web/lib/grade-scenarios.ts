import type { Grade } from "@/lib/api";
import type { VerdictKind } from "@/lib/verdict";

export const GRADE_ORDER: Grade[] = ["A", "B", "C", "D", "F"];

/** Illustrative copy for each depth letter — for what-if browsing, not a re-score. */
export const GRADE_SCENARIO: Record<
  Grade,
  { kind: Exclude<VerdictKind, "inconsistent" | "insufficient">; title: string; reason: string; depthHint: string }
> = {
  A: {
    kind: "healthy",
    title: "Healthy liquidity",
    depthHint: "Deep book · ≥80% in the 10¢ window",
    reason:
      "Most of this side's visible depth would sit inside a 10¢ move, so the displayed odds would be hard to shove with the size on the book. That is Thin Ice's top bar for healthy liquidity — not a forecast.",
  },
  B: {
    kind: "healthy",
    title: "Healthy liquidity",
    depthHint: "Solid depth · ≥55% in the 10¢ window",
    reason:
      "A large share of this market's own visible depth would sit behind a 10¢ move. The price would still read as relatively resilient on Thin Ice's current bar.",
  },
  C: {
    kind: "healthy",
    title: "Healthy liquidity",
    depthHint: "Adequate depth · ≥35% in the 10¢ window",
    reason:
      "Enough of this side's book would sit inside a 10¢ window to clear Thin Ice's healthy bar, though less cushion than A or B. Still not a forecast of what happens next.",
  },
  D: {
    kind: "fragile",
    title: "Fragile price",
    depthHint: "Thin depth · ≥15% in the 10¢ window",
    reason:
      "Too little of this market's own book would sit behind a 10¢ move. A larger trade could change the price you actually get — below Thin Ice's healthy bar.",
  },
  F: {
    kind: "fragile",
    title: "Fragile price",
    depthHint: "Exhausted or very thin near the mid",
    reason:
      "Few orders would be available near the current price. The visible book can run out before the odds move 10¢, so a larger trade can change the price you actually get.",
  },
};

export function nextGrade(g: Grade): Grade {
  const i = GRADE_ORDER.indexOf(g);
  return GRADE_ORDER[(i + 1) % GRADE_ORDER.length]!;
}

export function prevGrade(g: Grade): Grade {
  const i = GRADE_ORDER.indexOf(g);
  return GRADE_ORDER[(i - 1 + GRADE_ORDER.length) % GRADE_ORDER.length]!;
}
