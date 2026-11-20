"use client";

import type { Grade } from "@/lib/api";
import { GRADE_ORDER } from "@/lib/grade-scenarios";

const INK: Record<Grade, string> = {
  A: "#3DFFB0",
  B: "#5AE8B8",
  C: "#F0D45A",
  D: "#FFB84A",
  F: "#FF6B7A",
};

const GLOW: Record<Grade, string> = {
  A: "grade-glow-ok",
  B: "grade-glow-ok",
  C: "grade-glow-mid",
  D: "grade-glow-mid",
  F: "grade-glow-bad",
};

/** Depth grade A–F with ladder meter (cost-to-move-10¢). */
export function GradePill({
  grade,
  size = "sm",
  showLadder = true,
  onSelect,
}: {
  grade: Grade;
  size?: "sm" | "lg";
  showLadder?: boolean;
  /** When set, ladder ticks become a grade browser (what-if). */
  onSelect?: (grade: Grade) => void;
}) {
  const color = INK[grade];
  const letter = size === "lg" ? "text-5xl" : "text-2xl";
  const interactive = Boolean(onSelect);

  return (
    <span
      title={
        interactive
          ? `Browse depth grades — currently showing ${grade}`
          : `Liquidity grade ${grade}: based on order-book depth to move the odds 10¢`
      }
      aria-label={`Liquidity grade ${grade}${interactive ? ", click ticks to preview other grades" : ""}`}
      className="grade-stack inline-flex flex-col items-start gap-1"
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6f7882]">Depth</span>
      <span className={`grade-mark font-bold tabular-nums leading-none tracking-[-0.08em] ${letter} ${GLOW[grade]}`} style={{ color }}>
        {grade}
      </span>
      {showLadder && (
        <span className="grade-ladder flex items-center gap-0.5" aria-hidden={!interactive} role={interactive ? "group" : undefined}>
          {GRADE_ORDER.map((g) => {
            const on = g === grade;
            if (!onSelect) {
              return (
                <span
                  key={g}
                  className={`grade-tick inline-block h-1 rounded-full transition-all ${on ? "grade-tick-on w-3" : "w-1.5 opacity-35"}`}
                  style={{ background: on ? color : "#3a404a" }}
                />
              );
            }
            return (
              <button
                key={g}
                type="button"
                aria-label={`Preview grade ${g}`}
                aria-pressed={on}
                onClick={() => onSelect(g)}
                className={`grade-tick h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${
                  on ? "grade-tick-on w-3.5" : "w-2 opacity-40 hover:opacity-80"
                }`}
                style={{ background: on ? color : "#3a404a" }}
              />
            );
          })}
        </span>
      )}
    </span>
  );
}
