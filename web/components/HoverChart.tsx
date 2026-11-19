"use client";

import { useEffect, useId, useRef, useState } from "react";

type Point = { ts: number; value: number };
type Series = { label: string; color: string; points: Point[] };

function formatValue(kind: "pct" | "usd", n: number): string {
  if (kind === "pct") return `${Math.round(n)}%`;
  if (Math.abs(n) < 10) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function heldValue(points: Point[], t: number): number {
  let value = points[0].value;
  for (const p of points) {
    if (p.ts <= t) value = p.value;
    else break;
  }
  return value;
}

function stepPath(points: Point[], sx: (x: number) => number, sy: (y: number) => number): string {
  let d = `M${sx(points[0].ts).toFixed(1)},${sy(points[0].value).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H${sx(points[i].ts).toFixed(1)} V${sy(points[i].value).toFixed(1)}`;
  }
  return d;
}

export function HoverChart({
  series,
  format,
  aria,
}: {
  series: Series[];
  format: "pct" | "usd";
  aria: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const targetRef = useRef<number | null>(null);
  const shownRef = useRef<number | null>(null);
  const frame = useRef(0);
  const [shown, setShown] = useState<number | null>(null);
  const ready = series
    .map((s) => ({ ...s, points: s.points.filter((p) => Number.isFinite(p.value)).sort((a, b) => a.ts - b.ts) }))
    .filter((s) => s.points.length >= 2);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  if (ready.length === 0) {
    return <p className="text-sm text-[#8b95a1]">Not enough history yet. The recorder adds a point every few minutes.</p>;
  }

  const W = 720;
  const H = 228;
  const L = 4;
  const R = 64;
  const T = 12;
  const B = 28;
  const all = ready.flatMap((s) => s.points);
  const x0 = Math.min(...all.map((p) => p.ts));
  const x1 = Math.max(...all.map((p) => p.ts));
  let y0 = 0;
  let y1 = 100;
  if (format === "usd") {
    const peak = Math.max(...all.map((p) => p.value), 0);
    y1 = peak <= 0 ? 1 : peak * 1.08;
  }
  const sx = (x: number) => L + ((x - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = format === "pct"
    ? [0, 25, 50, 75, 100]
    : [0, 0.25, 0.5, 0.75, 1].map((f) => y0 + (y1 - y0) * f);
  const xTicks = [0, 1, 2, 3].map((i) => x0 + ((x1 - x0) * i) / 3);
  const span = Math.max(1, x1 - x0);

  function follow() {
    const target = targetRef.current;
    const cur = shownRef.current;
    if (target == null) {
      if (cur != null) {
        shownRef.current = null;
        setShown(null);
      }
      return;
    }
    const next = cur == null ? target : cur + (target - cur) * 0.34;
    const done = Math.abs(target - next) < span * 0.004;
    const value = done ? target : next;
    shownRef.current = value;
    setShown(value);
    if (!done) frame.current = requestAnimationFrame(follow);
  }

  function pointAt(clientX: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * W;
    const t = x0 + ((x - L) / (W - L - R)) * span;
    targetRef.current = Math.min(x1, Math.max(x0, t));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(follow);
  }

  function leave() {
    targetRef.current = null;
    cancelAnimationFrame(frame.current);
    shownRef.current = null;
    setShown(null);
  }

  const clock = (ts: number) => {
    const d = new Date(ts * 1000);
    if (span > 60 * 60 * 24 * 3) {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const tips = shown == null
    ? []
    : ready.map((s) => ({ label: s.label, color: s.color, value: heldValue(s.points, shown) }));

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        {ready.map((s) => {
          const value = shown == null ? s.points[s.points.length - 1].value : heldValue(s.points, shown);
          return (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-[#c5ced6]">{s.label}</span>
              <span className="font-semibold tabular-nums text-white">{formatValue(format, value)}</span>
            </li>
          );
        })}
      </ul>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair touch-none"
          role="img"
          aria-label={aria}
          onPointerMove={(e) => pointAt(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={leave}
        >
          <defs>
            {shown != null && (
              <clipPath id={clipId}>
                <rect x="0" y="0" width={sx(shown)} height={H} />
              </clipPath>
            )}
          </defs>
          {ticks.map((y) => (
            <g key={y}>
              <line
                x1={L}
                x2={W - R}
                y1={sy(y)}
                y2={sy(y)}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="1 4"
                strokeWidth="1"
              />
              <text x={W - R + 8} y={sy(y) + 4} fill="#8b95a1" fontSize="11">
                {formatValue(format, y)}
              </text>
            </g>
          ))}
          {ready.map((s, i) => (
            <g key={s.label} opacity={shown == null ? 1 : 0.28}>
              <path
                d={stepPath(s.points, sx, sy)}
                pathLength={1}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="miter"
                className="chart-draw"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            </g>
          ))}
          {shown != null && ready.map((s) => (
            <path
              key={`${s.label}-now`}
              d={stepPath(s.points, sx, sy)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.4"
              strokeLinejoin="miter"
              clipPath={`url(#${clipId})`}
            />
          ))}
          {shown != null && (
            <line x1={sx(shown)} x2={sx(shown)} y1={T} y2={H - B} stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
          )}
          {shown != null && tips.map((s) => (
            <circle key={s.label} cx={sx(shown)} cy={sy(s.value)} r="4.5" fill={s.color} stroke="#07080a" strokeWidth="2" />
          ))}
          {shown == null && ready.map((s) => {
            const last = s.points[s.points.length - 1];
            return (
              <g key={`${s.label}-live`}>
                <circle className="chart-ping" cx={sx(last.ts)} cy={sy(last.value)} r="4" fill="none" stroke={s.color} strokeWidth="1.5" />
                <circle cx={sx(last.ts)} cy={sy(last.value)} r="3.2" fill={s.color} stroke="#07080a" strokeWidth="1.5" />
              </g>
            );
          })}
          {xTicks.map((ts) => (
            <text key={ts} x={sx(ts)} y={H - 6} textAnchor={ts === x0 ? "start" : ts === x1 ? "end" : "middle"} fill="#8b95a1" fontSize="11">
              {clock(ts)}
            </text>
          ))}
        </svg>
        {shown != null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-[#16191f] px-2.5 py-1.5 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ left: `${Math.min(86, Math.max(14, (sx(shown) / W) * 100))}%`, top: 8 }}
          >
            <p className="text-[#9aa3ad]">{clock(shown)}</p>
            {tips.map((s) => (
              <p key={s.label} className="mt-0.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                <span className="max-w-40 truncate text-[#c5ced6]">{s.label}</span>
                <span className="font-semibold tabular-nums text-white">{formatValue(format, s.value)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
