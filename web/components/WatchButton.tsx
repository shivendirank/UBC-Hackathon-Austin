"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { readToken } from "@/lib/session";
import { fetchWatchlist, setWatching } from "@/lib/watchlist-api";

/** Star a market onto the signed-in user's watchlist. Guests are sent to login. */
export function WatchButton({
  symbol,
  compact = false,
}: {
  symbol: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = typeof window !== "undefined" ? Boolean(readToken()) : false;

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setOn(false);
      setReady(true);
      return;
    }
    try {
      const { symbols } = await fetchWatchlist();
      setOn(symbols.includes(symbol));
    } catch {
      setOn(false);
    } finally {
      setReady(true);
    }
  }, [symbol]);

  useEffect(() => {
    void refresh();
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ symbols?: string[] }>).detail;
      if (detail?.symbols) setOn(detail.symbols.includes(symbol));
    };
    window.addEventListener("thin-ice-watchlist", onEvt);
    return () => window.removeEventListener("thin-ice-watchlist", onEvt);
  }, [refresh, symbol]);

  async function toggle() {
    if (!readToken()) {
      const next = path && path !== "/login" ? path : `/market/${encodeURIComponent(symbol)}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next); // optimistic
    try {
      const symbols = await setWatching(symbol, next);
      setOn(symbols.includes(symbol));
    } catch {
      setOn(!next);
      if (!readToken()) {
        router.push(`/login?next=${encodeURIComponent(path || "/")}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || !ready}
        title={signedIn ? (on ? "Remove from watchlist" : "Add to watchlist") : "Sign in to save to watchlist"}
        aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
        aria-pressed={on}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none transition ${
          on ? "text-[#9aebff]" : "text-[#6f7882] hover:text-white"
        } disabled:opacity-40`}
      >
        {on ? "★" : "☆"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy || !ready}
      className={`rounded-full px-3 py-1.5 text-sm transition disabled:opacity-50 ${
        on ? "bg-[#14343a] text-[#9aebff]" : "bg-[#22262d] text-white hover:bg-[#2a3038]"
      }`}
    >
      {on ? "★ Watching" : "☆ Watch"}
    </button>
  );
}
