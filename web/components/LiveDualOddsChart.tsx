"use client";

import { useEffect, useState } from "react";
import { apiBase, type HistoryPoint, type Market } from "@/lib/api";
import { DualOddsChart } from "@/components/MoveCostChart";

type SeriesIn = { market: Market; points: HistoryPoint[]; stroke: string; label: string };

function midOf(p: { best_bid_c: number | null; best_ask_c: number | null; odds_pct?: number | null }): number | null {
  if (p.best_bid_c != null && p.best_ask_c != null) return (p.best_bid_c + p.best_ask_c) / 2;
  if (p.odds_pct != null) return p.odds_pct;
  return null;
}

function livePoint(market: Market): HistoryPoint | null {
  const mid = midOf({ ...market.score, odds_pct: market.odds_pct });
  if (mid == null) return null;
  return {
    ts: market.updated_at,
    grade: market.grade,
    move_cost_usd: market.move_cost_usd,
    spread_c: market.spread_c,
    best_bid_c: market.score.best_bid_c ?? mid,
    best_ask_c: market.score.best_ask_c ?? mid,
  };
}

/** Merge stored history with the latest live reading so the chart can draw immediately. */
export function seedHistory(history: HistoryPoint[], market: Market): HistoryPoint[] {
  const byTs = new Map<number, HistoryPoint>();
  for (const p of history) byTs.set(p.ts, p);
  const live = livePoint(market);
  if (live) byTs.set(live.ts, live);
  const points = [...byTs.values()].sort((a, b) => a.ts - b.ts);
  if (points.length === 1) {
    const only = points[0];
    return [{ ...only, ts: only.ts - 15 * 60 }, only];
  }
  return points;
}

function mergePoints(prev: HistoryPoint[], incoming: HistoryPoint[]): HistoryPoint[] {
  const seen = new Map(prev.map((p) => [p.ts, p]));
  for (const p of incoming) seen.set(p.ts, p);
  return [...seen.values()].sort((a, b) => a.ts - b.ts);
}

const POLL_MS = 8_000;

export function LiveDualOddsChart({ series }: { series: SeriesIn[] }) {
  const key = series.map((s) => s.market.symbol).join("|");
  const [histories, setHistories] = useState(() => series.map((s) => seedHistory(s.points, s.market)));

  useEffect(() => {
    setHistories(series.map((s) => seedHistory(s.points, s.market)));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when featured pair changes

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const batches = await Promise.all(
          series.map(async (s) => {
            const r = await fetch(`${apiBase()}/api/markets/${encodeURIComponent(s.market.symbol)}`);
            if (!r.ok) return seedHistory(s.points, s.market);
            const detail = (await r.json()) as Market & { history?: HistoryPoint[] };
            return seedHistory(detail.history ?? s.points, {
              ...s.market,
              ...detail,
              score: detail.score ?? s.market.score,
            });
          }),
        );
        if (cancelled) return;
        setHistories((prev) => batches.map((batch, i) => mergePoints(prev[i] ?? [], batch)));
      } catch {
        /* keep last good series */
      }
    }
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- poll the featured pair only

  return (
    <DualOddsChart
      height={200}
      series={series.map((s, i) => ({
        points: histories[i] ?? seedHistory(s.points, s.market),
        stroke: s.stroke,
        label: s.label,
      }))}
    />
  );
}
