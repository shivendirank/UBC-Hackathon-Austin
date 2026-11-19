"use client";

import { useEffect, useState } from "react";

const KEY = "thin-ice-watch";

export function readWatch(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeWatch(symbols: string[]) {
  localStorage.setItem(KEY, JSON.stringify(symbols));
}

export function WatchButton({ symbol }: { symbol: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(readWatch().includes(symbol));
  }, [symbol]);

  return (
    <button
      type="button"
      className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-[#14343a] text-[#9aebff]" : "bg-[#22262d] text-white"}`}
      onClick={() => {
        const next = readWatch().filter((s) => s !== symbol);
        if (!on) next.push(symbol);
        writeWatch(next);
        setOn(!on);
      }}
    >
      {on ? "Watching" : "Watch"}
    </button>
  );
}
