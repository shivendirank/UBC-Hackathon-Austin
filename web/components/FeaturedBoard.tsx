import Link from "next/link";
import { type HistoryPoint, type Market, type Relation } from "@/lib/api";
import { GradePill } from "@/components/GradePill";
import { GradeWhatIf } from "@/components/GradeWhatIf";
import { LiveDualOddsChart } from "@/components/LiveDualOddsChart";
import { Sticker } from "@/components/Stickers";
import { type EventBoard } from "@/lib/events";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { assess, relatedCheck } from "@/lib/verdict";

const COLORS = ["#28cc95", "#4c8dff", "#f26500"];

const VERDICT_TONE: Record<string, string> = {
  healthy: "text-[#3DFFB0]",
  fragile: "text-[#FF6B7A]",
  inconsistent: "text-[#FF8B98]",
  insufficient: "text-[#9aa3ad]",
};

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
    <section className="group w-full rounded-[18px] surface-card p-4 lg:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:items-stretch">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <Sticker category={board.category} title={board.title} ticker={lead.event_ticker} className="h-8 w-8 shrink-0" animated />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white lg:text-lg">{board.title}</h2>
                <FreshnessBadge updatedAt={board.updated} />
              </div>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7882]">
                {board.category ?? "Market"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {pair.map((m, i) => (
              <OutcomeButton key={m.symbol} market={m} color={COLORS[i] ?? COLORS[0]} inconsistent={inconsistent.has(m.symbol)} />
            ))}
          </div>

          <GradeWhatIf market={lead} verdict={verdict} />

          {/* Pinned to the bottom of the left column so the board doesn’t look empty next to the chart */}
          <div className="mt-auto space-y-3 border-t border-white/[0.06] pt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f7882]">Snapshot</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                <Metric label="Odds" value={lead.odds_pct != null ? `${lead.odds_pct.toFixed(0)}%` : "—"} />
                <Metric
                  label="Spread"
                  value={lead.spread_c != null ? `${lead.spread_c.toFixed(1)}¢` : "—"}
                />
                <Metric label="To move 10¢" value={`$${lead.move_cost_usd.toFixed(0)}`} />
                <Metric label="Book" value={lead.status ?? "—"} accent={lead.status === "OK" ? "ok" : "warn"} />
              </div>
              {related?.latest_check && (
                <p className={`mt-2 text-[12px] leading-snug ${broken ? "text-[#ff8b98]" : "text-[#7a8490]"}`}>
                  <span className="font-semibold uppercase tracking-[0.12em] text-[#6f7882]">Related · </span>
                  {related.latest_check.summary}
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-[#5c6570]">
                Observed {new Date(lead.updated_at * 1000).toLocaleString()}
                {lead.grade_words ? ` · ${lead.grade_words}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[13px]">
              <Link href={verdict.href} className="rounded-full bg-white px-3 py-1.5 font-semibold text-[#101216]">
                {verdict.action}
              </Link>
              <Link
                href={related ? `/compare?relation=${encodeURIComponent(related.id)}` : `/compare?symbol=${encodeURIComponent(lead.symbol)}`}
                className="rounded-full bg-[#1c2128] px-3 py-1.5 font-medium text-white"
              >
                {broken ? "See inconsistency" : "Compare related"}
              </Link>
              <Link href="/incidents" className="rounded-full bg-[#1c2128] px-3 py-1.5 font-medium text-white">
                Incidents
              </Link>
            </div>
          </div>
        </div>

        <div className="min-w-0 self-center">
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
    </section>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "ok" | "warn";
}) {
  const valueTone =
    accent === "ok" ? "text-[#3DFFB0]" : accent === "warn" ? "text-[#FF8B98]" : "text-white";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f7882]">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums tracking-tight ${valueTone}`}>{value}</p>
    </div>
  );
}

function OutcomeButton({ market, color, inconsistent }: { market: Market; color: string; inconsistent: boolean }) {
  const verdict = assess(market, inconsistent);
  return (
    <Link href={`/market/${encodeURIComponent(market.symbol)}`} className="group/out block min-w-0">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7882]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate normal-case tracking-normal text-[#b8c0c8] group-hover/out:text-white">
          {market.label ?? market.symbol}
        </span>
      </p>
      <p className="mt-1 flex items-end gap-2">
        <span className="text-[1.75rem] font-bold tabular-nums tracking-tight text-white">
          {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
        </span>
        <GradePill grade={market.grade} size="sm" />
      </p>
      <p className="mt-1 text-xs text-[#7a8490]">
        {inconsistent ? (
          <span className="text-[#ff8b98]">Inconsistent with related</span>
        ) : (
          <>
            <span className={VERDICT_TONE[verdict.kind] ?? "text-[#9aa3ad]"}>{verdict.title}</span>
            {verdict.freshness !== "live" && verdict.kind !== "insufficient" ? (
              <span className="text-[#5c6570]"> · {verdict.ageLabel}</span>
            ) : null}
          </>
        )}
      </p>
    </Link>
  );
}
