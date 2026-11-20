"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Grade, Market } from "@/lib/api";
import { GradePill } from "@/components/GradePill";
import { GRADE_SCENARIO, nextGrade, prevGrade } from "@/lib/grade-scenarios";
import type { Verdict } from "@/lib/verdict";

const TONE: Record<string, string> = {
  healthy: "text-[#3DFFB0]",
  fragile: "text-[#FF6B7A]",
  inconsistent: "text-[#FF8B98]",
  insufficient: "text-[#9aa3ad]",
};

/**
 * Depth grade with A–F what-if browsing: swipe or tap ladder ticks to preview
 * how the reading would look at each letter. Does not change the real score.
 */
export function GradeWhatIf({ market, verdict }: { market: Market; verdict: Verdict }) {
  const actual = market.grade;
  const [preview, setPreview] = useState<Grade>(actual);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setPreview(actual);
  }, [actual, market.symbol]);

  const scenario = GRADE_SCENARIO[preview];
  const isWhatIf = preview !== actual;
  const title = isWhatIf ? scenario.title : verdict.title;
  const reason = isWhatIf ? scenario.reason : verdict.reason;
  const kind = isWhatIf ? scenario.kind : verdict.kind;
  const tone = TONE[kind] ?? "text-white";

  const step = useCallback((dir: -1 | 1) => {
    setPreview((g) => (dir < 0 ? prevGrade(g) : nextGrade(g)));
  }, []);

  return (
    <div
      className="flex gap-3.5"
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) < 40) return;
        step(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex flex-col items-start gap-1.5">
        <GradePill grade={preview} size="lg" onSelect={setPreview} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous grade"
            onClick={() => step(-1)}
            className="rounded px-1.5 py-0.5 text-[11px] text-[#6f7882] hover:bg-white/[0.06] hover:text-white"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next grade"
            onClick={() => step(1)}
            className="rounded px-1.5 py-0.5 text-[11px] text-[#6f7882] hover:bg-white/[0.06] hover:text-white"
          >
            ›
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-bold tracking-tight ${tone}`}>{title}</p>
          {isWhatIf ? (
            <button
              type="button"
              onClick={() => setPreview(actual)}
              className="rounded-full bg-[#1c2128] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa3ad] hover:text-white"
            >
              What if · {preview} · reset
            </button>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5c6570]">
              Swipe grades
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[#9aa3ad]">
          {isWhatIf ? (
            <span className="text-[#b8c0c8]">{scenario.depthHint}</span>
          ) : (
            <>
              <span className="tabular-nums text-[#d7dde4]">${market.move_cost_usd.toFixed(0)}</span>
              {" to move 10¢"}
              {verdict.freshness !== "live" ? (
                <>
                  <span className="mx-1.5 text-[#3a404a]">·</span>
                  {verdict.ageLabel}
                </>
              ) : null}
            </>
          )}
        </p>
        <p className="mt-1.5 line-clamp-3 text-[12px] leading-snug text-[#9aa3ad]">{reason}</p>
      </div>
    </div>
  );
}
