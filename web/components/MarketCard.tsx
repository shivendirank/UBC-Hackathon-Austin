import Link from "next/link";
import { usd, type Market } from "@/lib/api";
import { bookStatus } from "@/lib/status";

const CHIP: Record<string, string> = {
  OK: "bg-[#e5f6f4] text-[#0b6e68]",
  "Runs out": "bg-[#fff1df] text-[#9a5b10]",
  Empty: "bg-[#eef2f6] text-[#5c6d7e]",
};

export function MarketCard({ market }: { market: Market }) {
  const status = bookStatus(market);
  const pct = market.odds_pct != null ? Math.max(0, Math.min(100, market.odds_pct)) : 0;
  return (
    <article className="flex flex-col rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(16,40,58,0.06)] ring-1 ring-[#e3ebf3] transition duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(16,40,58,0.1)]">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-[#e7f4f3] px-2.5 py-0.5 text-xs font-medium text-[#0b6e68]">
          {market.category ?? "Market"}
        </span>
      </div>
      <h2 className="mt-3 text-base font-semibold leading-snug text-[#142033]">
        <Link href={`/market/${encodeURIComponent(market.symbol)}`} className="hover:text-[#0e8f86]">
          {market.event_title ?? market.symbol}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-[#5c6d7e]">{market.label}</p>
      <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight text-[#10283a]">
        {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
      </p>
      <p className="text-xs font-medium text-[#5c6d7e]">YES</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7eef5]" aria-hidden>
        <div className="h-full rounded-full bg-[#12a39a]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[status]}`}>{status}</span>
        <span className="tabular-nums text-[#3d5163]">
          {status === "Empty" ? "No two-sided price" : `${usd(market.move_cost_usd)} to move 10¢`}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-medium">
        <Link href={`/market/${encodeURIComponent(market.symbol)}`} className="rounded-lg bg-[#f3f7fb] px-2 py-2 text-[#10283a] hover:bg-[#e5f6f4]">
          Reliability
        </Link>
        <Link href={`/compare?symbol=${encodeURIComponent(market.symbol)}`} className="rounded-lg bg-[#f3f7fb] px-2 py-2 text-[#10283a] hover:bg-[#e5f6f4]">
          Compare
        </Link>
        <Link href={`/market/${encodeURIComponent(market.symbol)}#warnings`} className="rounded-lg bg-[#f3f7fb] px-2 py-2 text-[#10283a] hover:bg-[#e5f6f4]">
          Investigate
        </Link>
      </div>
    </article>
  );
}
