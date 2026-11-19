import Link from "next/link";
import type { Market, Relation } from "@/lib/api";
import type { EventBoard } from "@/lib/events";
import { GradePill } from "@/components/GradePill";
import { Sticker } from "@/components/Stickers";
import { assess, relatedCheck, type VerdictKind } from "@/lib/verdict";

const CHIP: Record<VerdictKind, string> = {
  healthy: "bg-[#12382c] text-[#8ee0b0]",
  fragile: "bg-[#3a2c12] text-[#ffc46b]",
  inconsistent: "bg-[#3a1c24] text-[#ff8b98]",
  insufficient: "bg-[#232830] text-[#c5ced6]",
};

export function EventCard({
  board,
  inconsistent,
  relations,
}: {
  board: EventBoard;
  inconsistent: Set<string>;
  relations: Relation[];
}) {
  const shown = board.markets.slice(0, 2);
  const extra = board.markets.length - shown.length;
  const lead = board.markets[0];
  const boardBroken = shown.some((m) => inconsistent.has(m.symbol));
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
          <p className="mt-0.5 text-xs text-[#8b95a1]">{board.category ?? "Market"}</p>
          {boardBroken && (
            <p className="mt-1 text-xs font-medium text-[#ff8b98]">
              Related contracts disagree ·{" "}
              <Link href={`/compare?symbol=${encodeURIComponent(lead.symbol)}`} className="underline decoration-white/30 underline-offset-2">
                Compare
              </Link>
            </p>
          )}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06]">
        {shown.map((m) => (
          <Outcome key={m.symbol} market={m} inconsistent={inconsistent.has(m.symbol)} relations={relations} />
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

function Outcome({
  market,
  inconsistent,
  relations,
}: {
  market: Market;
  inconsistent: boolean;
  relations: Relation[];
}) {
  const verdict = assess(market, inconsistent);
  const observed = new Date(market.updated_at * 1000).toLocaleString();
  const related = relatedCheck(relations, market.symbol);
  const compareHref = related
    ? `/compare?relation=${encodeURIComponent(related.id)}`
    : `/compare?symbol=${encodeURIComponent(market.symbol)}`;
  return (
    <li className="py-3 first:pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <GradePill grade={market.grade} />
          <p className="min-w-0 text-sm text-[#d7dde4]">{market.label ?? market.symbol}</p>
        </div>
        <span className="text-lg font-semibold tabular-nums text-white">
          {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
        </span>
      </div>
      <details className="mt-2 group/verdict">
        <summary
          className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold marker:content-none [&::-webkit-details-marker]:hidden ${CHIP[verdict.kind]}`}
        >
          {verdict.title}
          <span aria-hidden className="text-[10px] opacity-70 transition-transform group-open/verdict:rotate-180">
            ▾
          </span>
        </summary>
        <p className="mt-2 text-sm leading-snug text-[#9aa3ad]">
          Grade {market.grade} from order-book depth (cost to move 10¢: ${market.move_cost_usd.toFixed(0)}). {verdict.reason}
        </p>
        {related?.latest_check && (
          <p className="mt-2 text-sm leading-snug text-[#9aa3ad]">
            Similar markets: {related.latest_check.summary}
          </p>
        )}
        <p className="mt-2 text-xs text-[#8b95a1]">Order book observed {observed}</p>
      </details>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={verdict.href} className="font-medium text-white underline decoration-white/30 underline-offset-4">
          {verdict.action}
        </Link>
        {related && (
          <Link href={compareHref} className="font-medium text-[#9aebff] underline decoration-[#9aebff]/30 underline-offset-4">
            {inconsistent ? "See inconsistency" : "Compare related"}
          </Link>
        )}
      </div>
    </li>
  );
}
