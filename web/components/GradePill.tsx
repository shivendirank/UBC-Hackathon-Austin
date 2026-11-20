"use client";

import { useEffect, useRef, useState } from "react";
import type { Grade } from "@/lib/api";
import { GRADE_ORDER, nextGrade, prevGrade } from "@/lib/grade-scenarios";

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

/** Depth grade A–F. Tap ticks or swipe to preview other letters (what-if). */
export function GradePill({
  grade,
  size = "sm",
  showLadder = true,
  browse = false,
  onSelect,
}: {
  grade: Grade;
  size?: "sm" | "lg";
  showLadder?: boolean;
  /** Swipe / tick browsing. Default on everywhere. */
  browse?: boolean;
  /** Controlled preview (parent owns state). */
  onSelect?: (grade: Grade) => void;
}) {
  const [local, setLocal] = useState<Grade>(grade);
  const touchX = useRef<number | null>(null);
  const controlled = Boolean(onSelect);
  const shown = controlled ? grade : local;

  useEffect(() => {
    if (!controlled) setLocal(grade);
  }, [grade, controlled]);

  const setShown = (g: Grade) => {
    if (onSelect) onSelect(g);
    else setLocal(g);
  };

  const interactive = browse || controlled;
  const color = INK[shown];
  const letter = size === "lg" ? "text-5xl" : "text-2xl";

  return (
    <span
      title={interactive ? `Browse depth grades — showing ${shown}` : `Liquidity grade ${shown}`}
      aria-label={`Liquidity grade ${shown}${interactive ? ", swipe or tap ticks to preview" : ""}`}
      className="grade-stack inline-flex touch-pan-y flex-col items-start gap-1 select-none"
      onTouchStart={(e) => {
        if (!interactive) return;
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (!interactive) return;
        const start = touchX.current;
        touchX.current = null;
        if (start == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) < 36) return;
        setShown(dx < 0 ? nextGrade(shown) : prevGrade(shown));
      }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6f7882]">Depth</span>
      <span className={`grade-mark font-bold tabular-nums leading-none tracking-[-0.08em] ${letter} ${GLOW[shown]}`} style={{ color }}>
        {shown}
      </span>
      {showLadder && (
        <span className="grade-ladder flex items-center gap-0.5" role={interactive ? "group" : undefined}>
          {GRADE_ORDER.map((g) => {
            const on = g === shown;
            if (!interactive) {
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShown(g);
                }}
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
