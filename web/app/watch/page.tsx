"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GradePill } from "@/components/GradePill";
import { WatchButton } from "@/components/WatchButton";
import { usd, type Market } from "@/lib/api";
import { readToken, readUser, type SessionUser } from "@/lib/session";
import { fetchWatchlist } from "@/lib/watchlist-api";
import { bookStatus } from "@/lib/status";

export default function WatchPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!readToken()) {
      setUser(null);
      setMarkets(null);
      return;
    }
    setUser(readUser());
    try {
      const data = await fetchWatchlist();
      setMarkets(data.markets);
      setError("");
    } catch (e) {
      if (e instanceof Error && e.message === "auth") {
        setUser(null);
        setMarkets(null);
        return;
      }
      setError("Could not load your watchlist.");
      setMarkets([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const onEvt = () => void load();
    window.addEventListener("thin-ice-watchlist", onEvt);
    return () => window.removeEventListener("thin-ice-watchlist", onEvt);
  }, [load]);

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Watchlist</h1>
        <p className="mt-2 text-sm text-[#8b95a1]">
          Sign in to save markets and keep an eye on their grades and odds.
        </p>
        <div className="mt-8 rounded-[20px] border border-white/10 bg-[#12141a] p-6">
          <p className="text-sm text-[#c5ced6]">
            Your watchlist is private to your account. Star any market from the Markets page or a market detail
            page after you log in.
          </p>
          <Link
            href="/login?next=%2Fwatch"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#101216]"
          >
            Log in to view watchlist
          </Link>
          <p className="mt-3 text-xs text-[#6f7882]">Demo: demo@thinice.local / demo1234</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Watchlist</h1>
      <p className="mt-2 text-sm text-[#8b95a1]">
        Saved for <span className="text-[#c5ced6]">{user.name || user.email}</span>. Star markets from the grid or a
        market page to add them here.
      </p>
      {error && <p className="mt-4 text-sm text-[#ff8b98]">{error}</p>}
      {markets == null ? (
        <p className="mt-8 text-sm text-[#8b95a1]">Loading watchlist…</p>
      ) : markets.length === 0 ? (
        <p className="mt-8 text-sm text-[#8b95a1]">
          No markets saved yet.{" "}
          <Link href="/" className="text-[#9aebff] hover:underline">
            Browse markets
          </Link>{" "}
          and tap the star.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-white/10">
          {markets.map((m) => {
            const status = bookStatus(m);
            return (
              <li key={m.symbol} className="flex items-start gap-3 py-3">
                <GradePill grade={m.grade} />
                <div className="min-w-0 flex-1">
                  <Link href={`/market/${encodeURIComponent(m.symbol)}`} className="hover:underline">
                    <span className="font-medium text-white">{m.label ?? m.symbol}</span>
                    <span className="block text-sm text-[#8b95a1]">{m.event_title}</span>
                  </Link>
                  <p className="mt-1 text-sm tabular-nums text-[#c5ced6]">
                    {m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "—"} · Grade {m.grade} · {status}
                    {status !== "Empty" ? ` · ${usd(m.move_cost_usd)} to move 10¢` : ""}
                  </p>
                </div>
                <WatchButton symbol={m.symbol} compact />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
