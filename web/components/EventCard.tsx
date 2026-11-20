"use client";

import Link from "next/link";
import type { Market, Relation } from "@/lib/api";
import type { EventBoard } from "@/lib/events";
import { GradeWhatIf } from "@/components/GradeWhatIf";
import { Sticker } from "@/components/Stickers";
import { WatchButton } from "@/components/WatchButton";
import { assess, relatedCheck } from "@/lib/verdict";

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
    <article className="group flex h-full flex-col rounded-[20px] surface-card p-5 transition-colors duration-300 hover:brightness-110">
      <div className="flex flex-1 flex-col">
        <div className="flex items-start gap-3">
          <Sticker category={board.category} title={board.title} ticker={lead.event_ticker} className="h-10 w-10 shrink-0" />
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
  const related = relatedCheck(relations, market.symbol);
  const compareHref = related
    ? `/compare?relation=${encodeURIComponent(related.id)}`
    : `/compare?symbol=${encodeURIComponent(market.symbol)}`;
  return (
    <li className="py-3 first:pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GradeWhatIf market={market} verdict={verdict} variant="compact" />
        </div>
        <span className="flex shrink-0 items-center gap-1 pt-0.5">
          <span className="text-lg font-semibold tabular-nums text-white">
            {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
          </span>
          <WatchButton symbol={market.symbol} compact />
        </span>
      </div>
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
