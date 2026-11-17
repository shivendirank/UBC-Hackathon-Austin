import type { CheckStatus } from "@/lib/api";

const STYLE: Record<string, { cls: string; word: string }> = {
  coherent: { cls: "bg-emerald-600 text-white", word: "Consistent" },
  theoretical_only: { cls: "bg-amber-400 text-black", word: "Inconsistent on paper" },
  executable: { cls: "bg-red-600 text-white", word: "Inconsistent at real prices" },
  stale: { cls: "bg-neutral-400 text-black", word: "Out-of-sync quotes" },
  insufficient_data: { cls: "bg-neutral-300 text-black", word: "Not enough data" },
  open: { cls: "bg-red-600 text-white", word: "Open" },
  reported: { cls: "bg-sky-600 text-white", word: "Investigated" },
  resolved: { cls: "bg-emerald-600 text-white", word: "Resolved" },
};

export function StatusPill({ status }: { status: CheckStatus | string }) {
  const s = STYLE[status] ?? { cls: "bg-neutral-300 text-black", word: status };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.word}</span>;
}

export const CONCLUSION_WORDS: Record<string, string> = {
  confirmed_inconsistency: "Confirmed inconsistency",
  stale_data: "Stale-data issue",
  different_rules: "Different contract rules",
  inconclusive: "Inconclusive",
  no_issue: "No issue",
};
