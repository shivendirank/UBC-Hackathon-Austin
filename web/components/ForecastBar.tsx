"use client";

import Link from "next/link";
import { useState } from "react";

export type ForecastItem = { href: string; title: string; pct: number };

export function ForecastBar({ items }: { items: ForecastItem[] }) {
  const [paused, setPaused] = useState(false);
  if (items.length < 2) return null;
  const loop = [items, items];
  return (
    <div className="flex items-center border-b border-transparent bg-[#0c0e12]">
      <p className="shrink-0 pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b95a1] lg:pl-8">
        Forecasts
      </p>
      <button
        type="button"
        onClick={() => setPaused((v) => !v)}
        className="mx-3 shrink-0 rounded-md px-1.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[#c5ced6] hover:text-white"
        aria-pressed={paused}
      >
        {paused ? "Play" : "Pause"}
      </button>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#0c0e12] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0c0e12] to-transparent" />
        <div className={`forecast-marquee flex w-max ${paused ? "is-paused" : ""}`}>
          {loop.map((copy, i) => (
            <ul key={i} className="flex shrink-0 items-center" aria-hidden={i === 1}>
              {copy.map((item) => (
                <li key={`${i}-${item.href}`}>
                  <Link href={item.href} className="flex items-baseline gap-2 whitespace-nowrap px-5 py-2.5 text-sm hover:text-white">
                    <span className="max-w-[34ch] truncate text-[#c5ced6]">{item.title}</span>
                    <span className="font-semibold tabular-nums text-white">{Math.round(item.pct)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
