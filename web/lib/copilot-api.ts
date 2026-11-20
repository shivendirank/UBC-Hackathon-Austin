/** Browser-safe Thin Ice API helpers for the ElevenLabs orb. */

import { apiBase } from "@/lib/api-base";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${apiBase()}${path}`, init);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return (await r.json()) as T;
}

export type CopilotAnalysis = {
  symbol: string;
  event_title: string | null;
  label: string | null;
  category: string | null;
  odds_pct: number | null;
  grade: string;
  grade_words: string;
  status?: string;
  move_cost_usd: number;
  spread_c: number | null;
  updated_at: number;
  synthetic?: boolean;
  liquidity_summary?: string;
  fills?: unknown[];
  depth?: Record<string, number>;
  resilience?: { share_thin: number | null; samples: number };
  reasons: string[];
  snapshot_hash: string | null;
  history: { ts: number; odds_pct: number | null; move_cost_usd: number; grade: string }[];
  error?: string;
};

export type CopilotRelated = {
  symbol: string;
  relations: {
    id: string;
    kind: string;
    verified: boolean;
    note?: string | null;
    members: {
      symbol: string;
      event_title?: string | null;
      label: string | null;
      odds_pct: number | null;
      grade: string;
      move_cost_usd: number;
    }[];
    latest_check: { status: string; summary: string } | null;
  }[];
};

export type CopilotResolve = {
  query: string;
  symbol: string;
  path: string;
  event_title: string | null;
  label: string | null;
  odds_pct: number | null;
  grade_words: string;
  move_cost_usd: number;
};

export const fetchCopilotStatus = () =>
  getJson<{ elevenlabs_configured: boolean; agent_id_set: boolean; api_key_set: boolean }>("/api/copilot/status");

export const createCopilotSession = (body: { symbol?: string | null; path?: string }) =>
  getJson<{
    configured: boolean;
    reason?: string;
    agent_id?: string;
    signed_url?: string | null;
    error?: string;
    context?: Record<string, unknown>;
  }>("/api/copilot/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const resolveMarket = (q: string) =>
  getJson<CopilotResolve>(`/api/copilot/resolve?q=${encodeURIComponent(q)}`);

export const fetchAnalysis = (symbol: string) =>
  getJson<CopilotAnalysis>(`/api/copilot/markets/${encodeURIComponent(symbol)}/analysis`);

export const fetchRelated = (symbol: string) =>
  getJson<CopilotRelated>(`/api/copilot/markets/${encodeURIComponent(symbol)}/related`);

export const fetchCompare = (symbols: string[]) =>
  getJson<{ markets: CopilotAnalysis[] }>("/api/copilot/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
