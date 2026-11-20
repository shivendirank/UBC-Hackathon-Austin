import { API_URL, type Market } from "@/lib/api";
import { readToken } from "@/lib/session";

function authHeaders(): HeadersInit {
  const token = readToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export async function fetchWatchlist(): Promise<{ symbols: string[]; markets: Market[] }> {
  const r = await fetch(`${API_URL}/api/watchlist`, { headers: authHeaders(), cache: "no-store" });
  if (r.status === 401) throw new Error("auth");
  if (!r.ok) throw new Error("watchlist");
  const data = await r.json();
  return {
    symbols: Array.isArray(data.symbols) ? data.symbols : [],
    markets: Array.isArray(data.markets) ? data.markets.filter((m: Market) => m && !("missing" in m && (m as { missing?: boolean }).missing)) : [],
  };
}

export async function setWatching(symbol: string, on: boolean): Promise<string[]> {
  const r = await fetch(`${API_URL}/api/watchlist/${encodeURIComponent(symbol)}`, {
    method: on ? "PUT" : "DELETE",
    headers: authHeaders(),
  });
  if (r.status === 401) throw new Error("auth");
  if (!r.ok) throw new Error("watchlist");
  const data = await r.json();
  const symbols: string[] = Array.isArray(data.symbols) ? data.symbols : [];
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("thin-ice-watchlist", { detail: { symbols } }));
  }
  return symbols;
}
