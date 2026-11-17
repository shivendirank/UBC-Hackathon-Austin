import type { HistoryPoint } from "@/lib/api";

// Dollars needed to move the odds 10 cents, over time (log scale so $5 and $50,000 both read).
export function MoveCostChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough history yet. The recorder adds a point every few minutes.</p>;
  }
  const W = 640, H = 160, P = 24;
  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => Math.log10(Math.max(1, p.move_cost_usd)));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [0, Math.max(4, ...ys)]; // at least up to $10,000 (grade A line)
  const sx = (x: number) => P + ((x - x0) / Math.max(1, x1 - x0)) * (W - 2 * P);
  const sy = (y: number) => H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(" ");
  const lines = [
    { y: 2, label: "$100 (D)" },
    { y: 3, label: "$1,000 (C)" },
    { y: 4, label: "$10,000 (A)" },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cost to move the odds 10 cents over time">
      {lines.map((l) => (
        <g key={l.y}>
          <line x1={P} x2={W - P} y1={sy(l.y)} y2={sy(l.y)} className="stroke-neutral-300 dark:stroke-neutral-700" strokeDasharray="4 4" />
          <text x={W - P} y={sy(l.y) - 4} textAnchor="end" className="fill-neutral-500 text-[10px]">{l.label}</text>
        </g>
      ))}
      <path d={d} fill="none" strokeWidth={2} className="stroke-sky-500" />
    </svg>
  );
}
