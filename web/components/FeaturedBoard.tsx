import Link from "next/link";
import { type HistoryPoint, type Market, type Relation } from "@/lib/api";
import { GradePill } from "@/components/GradePill";
import { LiveDualOddsChart } from "@/components/LiveDualOddsChart";
import { Sticker } from "@/components/Stickers";
import { type EventBoard } from "@/lib/events";
import { assess, bookIsFresh, relatedCheck } from "@/lib/verdict";

const COLORS = ["#28cc95", "#4c8dff", "#f26500"];

export function FeaturedBoard({
  board,
  histories,
  inconsistent,
  relations,
}: {
  board: EventBoard;
  histories: HistoryPoint[][];
  inconsistent: Set<string>;
  relations: Relation[];
}) {
  const pair = board.markets.slice(0, 2);
  const lead = pair[0];
  const broken = inconsistent.has(lead.symbol);
  const verdict = assess(lead, broken);
  const related = relatedCheck(relations, lead.symbol);
  return (
    <section className="group rounded-[24px] border border-white/10 bg-[#12141a] p-6 lg:p-8">
      <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <div className="flex items-start gap-3">
            <Sticker category={board.category} title={board.title} ticker={lead.event_ticker} className="h-11 w-11 shrink-0" animated />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{board.title}</h2>
                {bookIsFresh(board.updated) && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#ff8b98]">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#ff3b4e]" />
                    Live
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#8b95a1]">{board.category ?? "Market"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {pair.map((m, i) => (
              <OutcomeButton key={m.symbol} market={m} color={COLORS[i] ?? COLORS[0]} inconsistent={inconsistent.has(m.symbol)} />
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <GradePill grade={lead.grade} size="lg" />
            <div>
              <p className="text-sm font-semibold text-white">{verdict.title}</p>
              <p className="text-xs text-[#8b95a1]">Depth grade {lead.grade} · ${lead.move_cost_usd.toFixed(0)} to move 10¢</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-[#c5ced6]">{verdict.reason}</p>
          {related?.latest_check && (
            <p className={`mt-2 text-sm ${broken ? "text-[#ff8b98]" : "text-[#9aa3ad]"}`}>
              Related markets: {related.latest_check.summary}
            </p>
          )}
          <p className="mt-2 text-xs text-[#8b95a1]">Order book observed {new Date(lead.updated_at * 1000).toLocaleString()}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={verdict.href} className="rounded-full bg-white px-3 py-1.5 font-medium text-[#101216]">
              {verdict.action}
            </Link>
            <Link
              href={related ? `/compare?relation=${encodeURIComponent(related.id)}` : `/compare?symbol=${encodeURIComponent(lead.symbol)}`}
              className="rounded-full bg-[#22262d] px-3 py-1.5 text-white"
            >
              {broken ? "See inconsistency" : "Compare related"}
            </Link>
            <Link href="/incidents" className="rounded-full bg-[#22262d] px-3 py-1.5 text-white">
              Incidents
            </Link>
          </div>
        </div>
        <div className="min-w-0">
          <LiveDualOddsChart
            series={pair.map((m, i) => ({
              market: m,
              points: histories[i] ?? [],
              stroke: COLORS[i] ?? COLORS[0],
              label: m.label ?? m.symbol,
            }))}
          />
        </div>
      </div>
      </div>
    </section>
  );
}

function OutcomeButton({ market, color, inconsistent }: { market: Market; color: string; inconsistent: boolean }) {
  const verdict = assess(market, inconsistent);
  return (
    <Link
      href={`/market/${encodeURIComponent(market.symbol)}`}
      className="rounded-2xl border border-white/10 bg-[#1a1d24] px-5 py-4"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium leading-snug text-[#d7dde4]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{market.label ?? market.symbol}</span>
        </span>
        <GradePill grade={market.grade} />
      </span>
      <span className="mt-2 block text-3xl font-semibold tabular-nums text-white">
        {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
      </span>
      <span className="mt-1 block text-xs text-[#9aa3ad]">
        {inconsistent ? "Inconsistent with related" : `Grade ${market.grade} · ${verdict.title}`}
      </span>
    </Link>
  );
}
