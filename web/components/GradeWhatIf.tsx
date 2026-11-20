"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import type { Grade, Market } from "@/lib/api";
import { GradePill } from "@/components/GradePill";
import { GRADE_SCENARIO, nextGrade, prevGrade } from "@/lib/grade-scenarios";
import type { Verdict } from "@/lib/verdict";

const CHIP: Record<string, string> = {
  healthy: "bg-[#12382c] text-[#8ee0b0]",
  fragile: "bg-[#3a1c24] text-[#ff8b98]",
  inconsistent: "bg-[#3a1c24] text-[#ff8b98]",
  insufficient: "bg-[#232830] text-[#c5ced6]",
};

type Variant = "featured" | "compact" | "panel";

/**
 * Small by default. Click the verdict bar (Fragile price / Healthy…) to open
 * A–F what-if browsing. Does not change the real score.
 */
export function GradeWhatIf({
  market,
  verdict,
  variant = "featured",
  label,
}: {
  market: Market;
  verdict: Verdict;
  variant?: Variant;
  /** Optional contract label (compact cards). */
  label?: string;
}) {
  const actual = market.grade;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Grade>(actual);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setPreview(actual);
    setOpen(false);
  }, [actual, market.symbol]);

  useEffect(() => {
    if (!open) setPreview(actual);
  }, [open, actual]);

  const scenario = GRADE_SCENARIO[preview];
  const isWhatIf = open && preview !== actual;
  const title = isWhatIf ? scenario.title : verdict.title;
  const reason = isWhatIf ? scenario.reason : verdict.reason;
  const kind = isWhatIf ? scenario.kind : verdict.kind;
  const shownGrade = open ? preview : actual;

  const step = useCallback((dir: -1 | 1) => {
    setPreview((g) => (dir < 0 ? prevGrade(g) : nextGrade(g)));
  }, []);

  const swipeProps = open
    ? {
        onTouchStart: (e: TouchEvent) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        },
        onTouchEnd: (e: TouchEvent) => {
          const start = touchX.current;
          touchX.current = null;
          if (start == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(dx) < 40) return;
          step(dx < 0 ? 1 : -1);
        },
      }
    : {};

  const chipLabel = isWhatIf ? `${title} · if ${preview}` : verdict.title;
  const chip = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      title={verdict.freshness !== "live" ? `${verdict.title} · ${verdict.ageLabel}` : verdict.title}
      className={`inline-flex max-w-full cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none transition-opacity hover:opacity-90 ${CHIP[kind]}`}
    >
      <span className="truncate">{chipLabel}</span>
      <span aria-hidden className={`shrink-0 text-[9px] opacity-70 transition-transform ${open ? "rotate-180" : ""}`}>
        ▾
      </span>
    </button>
  );

  if (variant === "compact") {
    return (
      <div className="min-w-0" {...swipeProps}>
        <div className="flex min-w-0 items-start gap-2">
          <GradePill
            grade={shownGrade}
            browse={open}
            onSelect={open ? setPreview : undefined}
          />
          <p className="min-w-0 text-sm text-[#d7dde4]">{label ?? market.label ?? market.symbol}</p>
        </div>
        <div className="mt-2">{chip}</div>
        {open && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-[#6f7882]">
              {isWhatIf ? scenario.depthHint : "Swipe or tap ticks to preview other depth grades"}
            </p>
            <p className="line-clamp-3 text-[12px] leading-snug text-[#9aa3ad]">{reason}</p>
            {isWhatIf && (
              <button
                type="button"
                onClick={() => setPreview(actual)}
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f7882] hover:text-white"
              >
                Reset to {actual}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div className="min-w-0" {...swipeProps}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {chip}
            <p className="mt-1.5 text-xs text-[#9aa3ad]">
              {isWhatIf ? (
                scenario.depthHint
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
            {open && <p className="mt-2 text-sm leading-snug text-[#c5ced6]">{reason}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <GradePill grade={shownGrade} size="lg" browse={open} onSelect={open ? setPreview : undefined} />
            {open && (
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous grade" onClick={() => step(-1)} className="rounded px-1.5 py-0.5 text-[11px] text-[#6f7882] hover:text-white">
                  ‹
                </button>
                <button type="button" aria-label="Next grade" onClick={() => step(1)} className="rounded px-1.5 py-0.5 text-[11px] text-[#6f7882] hover:text-white">
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* featured — compact until the verdict chip is opened */
  return (
    <div className="flex gap-3.5" {...swipeProps}>
      <GradePill grade={shownGrade} size="lg" browse={open} onSelect={open ? setPreview : undefined} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {chip}
          {isWhatIf && (
            <button
              type="button"
              onClick={() => setPreview(actual)}
              className="rounded-full bg-[#1c2128] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa3ad] hover:text-white"
            >
              Reset to {actual}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-[#9aa3ad]">
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
        {open && <p className="mt-1.5 line-clamp-3 text-[12px] leading-snug text-[#9aa3ad]">{reason}</p>}
      </div>
    </div>
  );
}
