"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, usd, type Market } from "@/lib/api";
import { readWatch } from "@/components/WatchButton";
import { bookStatus } from "@/lib/status";

export default function WatchPage() {
  const [markets, setMarkets] = useState<Market[] | null>(null);

  useEffect(() => {
    const symbols = new Set(readWatch());
    fetch(`${API_URL}/api/markets?limit=500&sort=deep`)
      .then((r) => r.json())
      .then((data: { markets: Market[] }) => {
        setMarkets((data.markets ?? []).filter((m) => symbols.has(m.symbol)));
      })
      .catch(() => setMarkets([]));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Watchlist</h1>
      <p className="mt-2 text-sm text-[#8b95a1]">
        Saved in this browser only. Thin Ice does not send alerts yet.
      </p>
      {markets == null ? (
        <p className="mt-8 text-sm text-neutral-500">Loading watchlist…</p>
      ) : markets.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No markets saved. Open a market and choose Watch.</p>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {markets.map((m) => {
            const status = bookStatus(m);
            return (
              <li key={m.symbol} className="py-3">
                <Link href={`/market/${encodeURIComponent(m.symbol)}`} className="hover:underline">
                  <span className="font-medium">{m.label}</span>
                  <span className="block text-sm text-neutral-500">{m.event_title}</span>
                </Link>
                <p className="mt-1 text-sm tabular-nums">
                  {m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "—"} · {status}
                  {status !== "Empty" ? ` · ${usd(m.move_cost_usd)} to move 10¢` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
