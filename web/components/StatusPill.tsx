import type { CheckStatus } from "@/lib/api";

const STYLE: Record<string, { cls: string; word: string }> = {
  coherent: { cls: "bg-[#12382c] text-[#8ee0b0]", word: "Consistent" },
  theoretical_only: { cls: "bg-[#3a2c12] text-[#ffc46b]", word: "Inconsistent on paper" },
  executable: { cls: "bg-[#3a1c24] text-[#ff8b98]", word: "Inconsistent at real prices" },
  stale: { cls: "bg-[#232830] text-[#c5ced6]", word: "Out-of-sync quotes" },
  insufficient_data: { cls: "bg-[#232830] text-[#c5ced6]", word: "Not enough data" },
  pending: { cls: "bg-[#232830] text-[#c5ced6]", word: "Awaiting books" },
  open: { cls: "bg-[#3a1c24] text-[#ff8b98]", word: "Open" },
  reported: { cls: "bg-[#1a2a3a] text-[#9aebff]", word: "Investigated" },
  resolved: { cls: "bg-[#12382c] text-[#8ee0b0]", word: "Resolved" },
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
