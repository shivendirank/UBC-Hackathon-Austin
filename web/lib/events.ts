import type { Market } from "@/lib/api";
import { BOOK_LIVE_S, freshnessRank } from "@/lib/verdict";

export type EventBoard = {
  key: string;
  title: string;
  category: string | null;
  markets: Market[];
  synthetic: boolean;
  updated: number;
};

export function groupEvents(markets: Market[]): EventBoard[] {
  const map = new Map<string, EventBoard>();
  for (const m of markets) {
    const key = m.event_slug || m.event_title || m.symbol;
    const synthetic = Boolean(m.synthetic || m.event_title?.includes("Synthetic replay"));
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        key,
        title: m.event_title || m.symbol,
        category: m.category,
        markets: [m],
        synthetic,
        updated: m.updated_at,
      });
    } else {
      cur.markets.push(m);
      if (m.updated_at > cur.updated) cur.updated = m.updated_at;
      cur.synthetic = cur.synthetic || synthetic;
      if (!cur.category && m.category) cur.category = m.category;
    }
  }
  const boards = [...map.values()];
  for (const b of boards) {
    // Prefer fresher contracts inside an event, then deeper books.
    b.markets.sort(
      (a, c) =>
        freshnessRank(c.updated_at) - freshnessRank(a.updated_at) ||
        (c.odds_pct != null ? 1 : 0) - (a.odds_pct != null ? 1 : 0) ||
        c.move_cost_usd - a.move_cost_usd,
    );
  }
  // Lead with live/recent boards, then deeper liquidity.
  boards.sort(
    (a, b) =>
      freshnessRank(b.updated) - freshnessRank(a.updated) ||
      (b.markets[0]?.move_cost_usd ?? 0) - (a.markets[0]?.move_cost_usd ?? 0),
  );
  return boards;
}

/** Round-robin categories so one ladder (BTC strikes) cannot fill the grid. */
export function mixBoards(boards: EventBoard[]): EventBoard[] {
  const buckets = new Map<string, EventBoard[]>();
  for (const b of boards) {
    const key = b.category ?? "Other";
    const list = buckets.get(key) ?? [];
    list.push(b);
    buckets.set(key, list);
  }
  // Keep each category ordered by freshness (groupEvents already sorted; reaffirm).
  for (const list of buckets.values()) {
    list.sort(
      (a, b) =>
        freshnessRank(b.updated) - freshnessRank(a.updated) ||
        (b.markets[0]?.move_cost_usd ?? 0) - (a.markets[0]?.move_cost_usd ?? 0),
    );
  }
  const rank = ["Sports", "Politics", "Economics", "Weather", "Commodities", "Tech", "Crypto", "Synthetic"];
  const keys = [...buckets.keys()].sort((a, b) => {
    const ia = rank.indexOf(a);
    const ib = rank.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const out: EventBoard[] = [];
  for (let i = 0; out.length < boards.length; i++) {
    let added = false;
    for (const key of keys) {
      const item = buckets.get(key)?.[i];
      if (item) {
        out.push(item);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

export function ago(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function isLive(ts: number): boolean {
  return Date.now() / 1000 - ts <= BOOK_LIVE_S;
}
