import type { FreshnessBand } from "@/lib/verdict";
import { bookFreshness, freshnessLabel } from "@/lib/verdict";

const TONE: Record<FreshnessBand, string> = {
  live: "text-[#ff8b98]",
  recent: "text-[#9aebff]",
  aging: "text-[#ffc46b]",
  archived: "text-[#8b95a1]",
};

export function FreshnessBadge({
  updatedAt,
  className = "",
}: {
  updatedAt: number;
  className?: string;
}) {
  const band = bookFreshness(updatedAt);
  const label = freshnessLabel(updatedAt);
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${TONE[band]} ${className}`}>
      {band === "live" && <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#ff3b4e]" aria-hidden />}
      {label}
    </span>
  );
}
