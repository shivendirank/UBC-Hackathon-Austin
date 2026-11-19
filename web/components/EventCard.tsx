import Link from "next/link";
import type { Market } from "@/lib/api";
import type { EventBoard } from "@/lib/events";
import { Sticker } from "@/components/Stickers";
import { assess, type VerdictKind } from "@/lib/verdict";

const CHIP: Record<VerdictKind, string> = {
  healthy: "bg-[#12382c] text-[#8ee0b0]",
  fragile: "bg-[#3a2c12] text-[#ffc46b]",
  inconsistent: "bg-[#3a1c24] text-[#ff8b98]",
  insufficient: "bg-[#232830] text-[#c5ced6]",
};

export function EventCard({ board, inconsistent }: { board: EventBoard; inconsistent: Set<string> }) {
  const shown = board.markets.slice(0, 2);
  const extra = board.markets.length - shown.length;
  const lead = board.markets[0];
  return (
    <article className="group flex h-full flex-col rounded-[20px] border border-white/10 bg-[#12141a] p-5 transition-colors duration-300 hover:border-white/25">
      <div className="flex flex-1 flex-col">
      <div className="flex items-start gap-3">
        <Sticker category={board.category} title={board.title} ticker={lead.event_ticker} className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug text-white">
            <Link href={`/market/${encodeURIComponent(lead.symbol)}`} className="hover:text-[#9aebff]">
              {board.title}
            </Link>
          </h2>
          <p className="mt-0.5 text-xs text-[#8b95a1]">{board.category ?? "Market"}{board.synthetic ? " · demo replay" : ""}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06]">
        {shown.map((m) => (
          <Outcome key={m.symbol} market={m} inconsistent={inconsistent.has(m.symbol)} />
        ))}
      </ul>

      {extra > 0 && (
        <Link href={`/market/${encodeURIComponent(lead.symbol)}`} className="mt-3 text-sm text-[#9aa3ad] hover:text-white">
          + {extra} more
        </Link>
      )}
      </div>
    </article>
  );
}

function Outcome({ market, inconsistent }: { market: Market; inconsistent: boolean }) {
  const verdict = assess(market, inconsistent);
  const observed = new Date(market.updated_at * 1000).toLocaleString();
  return (
    <li className="py-3 first:pt-1">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm text-[#d7dde4]">{market.label ?? market.symbol}</p>
        <span className="text-lg font-semibold tabular-nums text-white">
          {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
        </span>
      </div>
      <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP[verdict.kind]}`}>{verdict.title}</p>
      <p className="mt-1 text-sm leading-snug text-[#9aa3ad]">{verdict.reason}</p>
      <p className="mt-2 text-xs text-[#8b95a1]">Order book observed {observed}</p>
      <Link href={verdict.href} className="mt-2 inline-block text-sm font-medium text-white underline decoration-white/30 underline-offset-4">
        {verdict.action}
      </Link>
    </li>
  );
}
