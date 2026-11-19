import type { Grade } from "@/lib/api";

const STYLE: Record<Grade, string> = {
  A: "bg-[#12382c] text-[#8ee0b0] ring-[#28cc95]/35",
  B: "bg-[#12382c] text-[#8ee0b0] ring-[#28cc95]/25",
  C: "bg-[#2a3118] text-[#d4e07a] ring-[#a8b84a]/30",
  D: "bg-[#3a2c12] text-[#ffc46b] ring-[#ffc46b]/30",
  F: "bg-[#3a1c24] text-[#ff8b98] ring-[#ff8b98]/30",
};

/** A–F depth grade from cost-to-move-10¢ (scoring.py). */
export function GradePill({
  grade,
  size = "sm",
}: {
  grade: Grade;
  size?: "sm" | "lg";
}) {
  const box = size === "lg" ? "h-12 w-12 text-2xl" : "h-7 w-7 text-sm";
  return (
    <span
      title={`Liquidity grade ${grade}: based on order-book depth to move the odds 10¢`}
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums ring-1 ${STYLE[grade]}`}
    >
      {grade}
    </span>
  );
}
