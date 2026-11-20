"use client";

import type { Market } from "@/lib/api";
import { GradeWhatIf } from "@/components/GradeWhatIf";
import type { Verdict } from "@/lib/verdict";

/** Client island for market / compare grade what-if browsing. */
export function MarketGradePanel({ market, verdict }: { market: Market; verdict: Verdict }) {
  return <GradeWhatIf market={market} verdict={verdict} variant="panel" />;
}
