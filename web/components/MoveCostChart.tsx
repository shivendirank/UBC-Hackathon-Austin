import type { HistoryPoint } from "@/lib/api";
import { HoverChart } from "@/components/HoverChart";

function mid(p: HistoryPoint): number | null {
  if (p.best_bid_c == null || p.best_ask_c == null) return null;
  return (p.best_bid_c + p.best_ask_c) / 2;
}

export function MoveCostChart({ points }: { points: HistoryPoint[] }) {
  return (
    <HoverChart
      aria="Cost to move the odds 10 cents over time"
      format="usd"
      series={[{
        label: "To move 10¢",
        color: "#9aa3ad",
        points: points.map((p) => ({ ts: p.ts, value: p.move_cost_usd })),
      }]}
    />
  );
}

export function OddsChart({ points, stroke = "#28cc95" }: { points: HistoryPoint[]; stroke?: string }) {
  return (
    <HoverChart
      aria="YES odds over time"
      format="pct"
      series={[{
        label: "YES",
        color: stroke,
        points: points.flatMap((p) => {
          const value = mid(p);
          return value == null ? [] : [{ ts: p.ts, value }];
        }),
      }]}
    />
  );
}

export function DualOddsChart({
  series,
}: {
  series: { points: HistoryPoint[]; stroke: string; label: string }[];
}) {
  return (
    <HoverChart
      aria="YES odds of the contracts in this group"
      format="pct"
      series={series.map((s) => ({
        label: s.label,
        color: s.stroke,
        points: s.points.flatMap((p) => {
          const value = mid(p);
          return value == null ? [] : [{ ts: p.ts, value }];
        }),
      }))}
    />
  );
}
