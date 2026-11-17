import { connection } from "next/server";

// Types mirror backend/thin_ice/service.py. Keep them in sync (see CLAUDE.md, API contract).

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Grade = "A" | "B" | "C" | "D" | "F";

export type Score = {
  symbol: string;
  ts: number;
  grade: Grade;
  best_bid_c: number | null;
  best_ask_c: number | null;
  mid_c: number | null;
  spread_c: number | null;
  cost_up_usd: number;
  cost_down_usd: number;
  move_cost_usd: number;
  cheaper_direction: "up" | "down" | null;
  exhausted: boolean;
  last_trade_ts: number | null;
  spoof_cost_usd: number | null;
  reasons: string[];
  formula_version: string;
};

export type Market = {
  symbol: string;
  event_title: string | null;
  event_slug: string | null;
  label: string | null;
  category: string | null;
  grade: Grade;
  grade_words: string;
  odds_pct: number | null;
  move_cost_usd: number;
  spread_c: number | null;
  updated_at: number;
  score: Score;
};

export type HistoryPoint = {
  ts: number;
  grade: Grade;
  move_cost_usd: number;
  spread_c: number | null;
  best_bid_c: number | null;
  best_ask_c: number | null;
};

export type Receipt = {
  id: number;
  ts: number;
  grade: Grade;
  snapshot_hash: string;
  uri: string | null;
  tx_sig: string | null;
  receipt_pda: string | null;
  explorer_url?: string;
};

export type Alert = { id: number; symbol: string; ts: number; kind: string; detail: Record<string, unknown> };

export type Fill = {
  side: "buy_yes" | "sell_yes";
  target_usd: number;
  filled_usd: number;
  contracts: number;
  avg_price_c: number | null;
  worst_price_c: number | null;
  slippage_c: number | null;
  complete: boolean;
};

export type Liquidity = {
  fills: Fill[];
  depth: Record<string, number>;
  levels: { bids: number; asks: number };
  summary: string;
};

export type Resilience = {
  samples: number;
  observed_s?: number;
  share_thin: number | null;
  longest_thin_s: number | null;
  around_moves: { ts: number; from_c: number; to_c: number; move_cost_before: number; move_cost_after: number }[];
};

export type CheckStatus = "coherent" | "theoretical_only" | "executable" | "stale" | "insufficient_data";

export type CheckResult = {
  relation_id: string;
  kind: string;
  verified: boolean;
  ts: number;
  status: CheckStatus;
  summary: string;
  prices_c: Record<string, number | null>;
  coherent_c: Record<string, number>;
  gap_c: number;
  violations: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  max_skew_s: number;
  excluded: string[];
};

export type Relation = {
  id: string;
  kind: string;
  members: string[];
  source: string;
  verified: boolean;
  event_ticker: string | null;
  note: string;
  latest_check: CheckResult | null;
};

export type Incident = {
  id: number;
  kind: "inconsistency" | "unusual_move" | "liquidity_drop";
  subject: string;
  status: "open" | "reported" | "resolved";
  conclusion: string | null;
  opened_at: number;
  updated_at: number;
  evidence: Record<string, unknown>;
  timeline: { ts: number; event: string; detail: Record<string, unknown> }[];
  report: { conclusion: string; summary: string; sources: string[]; details: string; author: string; ts: number } | null;
};

export type IncidentDetail = Incident & {
  relation?: { id: string; kind: string; members: string[]; verified: number } | null;
  latest_check?: CheckResult | null;
  contracts: { symbol: string; event_title: string; label: string; expiry: string; terms_url: string | null }[];
};

export type MarketDetail = Market & {
  liquidity: Liquidity | null;
  resilience: Resilience;
  relations: { id: string; kind: string; verified: number }[];
  history: HistoryPoint[];
  receipts: Receipt[];
  alerts: Alert[];
  snapshot_hash: string | null;
};

async function get<T>(path: string): Promise<T | null> {
  await connection(); // live data: render at request time, never at build time
  try {
    const r = await fetch(`${API_URL}${path}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return (await r.json()) as T;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export const getMarkets = (category?: string) =>
  get<{ markets: Market[] }>(`/api/markets${category ? `?category=${encodeURIComponent(category)}` : ""}`);
export const getMarket = (symbol: string) => get<MarketDetail>(`/api/markets/${encodeURIComponent(symbol)}`);

export const getIncidents = (status?: string) =>
  get<{ incidents: Incident[] }>(`/api/incidents${status ? `?status=${status}` : ""}`);
export const getIncident = (id: string) => get<IncidentDetail>(`/api/incidents/${encodeURIComponent(id)}`);
export const getRelations = () => get<{ relations: Relation[] }>("/api/relations");

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });
