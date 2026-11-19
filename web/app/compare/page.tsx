import Link from "next/link";
import { GradePill } from "@/components/GradePill";
import { LiveDualOddsChart } from "@/components/LiveDualOddsChart";
import { StatusPill } from "@/components/StatusPill";
import {
  getMarket,
  getMarkets,
  getRelations,
  usd,
  type Market,
  type MarketDetail,
  type Relation,
} from "@/lib/api";
import { bookStatus } from "@/lib/status";
import { assess, relationStory } from "@/lib/verdict";

export default async function ComparePage(props: {
  searchParams: Promise<{ symbol?: string; relation?: string; a?: string; b?: string }>;
}) {
  const sp = await props.searchParams;
  const aSym = typeof sp.a === "string" ? sp.a : "";
  const bSym = typeof sp.b === "string" ? sp.b : "";
  const symbol = typeof sp.symbol === "string" ? sp.symbol : "";
  const relationId = typeof sp.relation === "string" ? sp.relation : "";

  const [marketsData, relationsData] = await Promise.all([getMarkets({ sort: "deep", limit: 500 }), getRelations()]);
  const markets = (marketsData?.markets ?? []).filter(
    (m) => bookStatus(m) !== "Empty" && !m.synthetic && !m.event_title?.includes("Synthetic replay"),
  );
  const bySymbol = new Map(markets.map((m) => [m.symbol, m]));
  const relations = (relationsData?.relations ?? []).filter((r) => r.source !== "synthetic");

  // /compare?relation=id → jump into a vs b from that group
  if (relationId && (!aSym || !bSym)) {
    const rel = relations.find((r) => r.id === relationId);
    const pair = pickPairFromRelation(rel, bySymbol);
    if (pair) {
      return <SideBySide aSym={pair[0].symbol} bSym={pair[1].symbol} relations={relations} />;
    }
  }

  if (aSym && bSym) {
    return <SideBySide aSym={aSym} bSym={bSym} relations={relations} />;
  }

  const selected = symbol ? (bySymbol.get(symbol) ?? (await getMarket(symbol))) : null;
  const leftList = rankMarkets(markets).slice(0, 40);
  const similar = selected ? findSimilar(selected, markets, relations) : [];
  return (
    <main className="relative mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-8">
      <Link href="/" className="text-sm font-medium text-[#9aebff] hover:underline">All markets</Link>
      <div className="mt-4 max-w-2xl pr-28 sm:pr-36">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Compare markets</h1>
        <p className="mt-2 text-[#9aa3ad]">
          Live Gemini order books only — no synthetic replays. Pick a market on the left, then a related one on the right. Opening a pair re-pulls both books before comparing.
        </p>
      </div>
      {!marketsData && (
        <p className="mt-4 rounded-2xl border border-[#f0d7a8] bg-[#2a2116] p-4 text-sm text-[#f0d7a8]">
          Can&apos;t reach the Thin Ice API for live Gemini grades. Start uvicorn in backend/.
        </p>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-[24px] border border-white/10 bg-[#12141a] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8b95a1]">1 · Choose a market</h2>
          <ul className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {leftList.map((m) => {
              const on = selected?.symbol === m.symbol;
              return (
                <li key={m.symbol}>
                  <Link
                    href={`/compare?symbol=${encodeURIComponent(m.symbol)}`}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                      on ? "border-white bg-[#1c2128]" : "border-white/10 bg-[#1a1d24] hover:border-white/25"
                    }`}
                  >
                    <GradePill grade={m.grade} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{m.label ?? m.symbol}</span>
                      <span className="block truncate text-xs text-[#8b95a1]">{m.event_title}</span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums text-white">
                      {m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[#12141a] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8b95a1]">2 · Pick a similar market</h2>
          {!selected ? (
            <p className="mt-10 text-sm text-[#8b95a1]">Select a market on the left to see related contracts you can compare.</p>
          ) : similar.length === 0 ? (
            <div className="mt-10">
              <p className="text-sm text-[#8b95a1]">No related contracts on file for this market yet.</p>
              <Link href={`/market/${encodeURIComponent(selected.symbol)}`} className="mt-3 inline-block text-sm text-[#9aebff] hover:underline">
                Open {selected.label ?? selected.symbol}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {similar.map((item) => (
                <li key={item.market.symbol}>
                  <Link
                    href={`/compare?a=${encodeURIComponent(selected.symbol)}&b=${encodeURIComponent(item.market.symbol)}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1d24] px-3 py-3 transition-colors hover:border-white/30"
                  >
                    <GradePill grade={item.market.grade} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{item.market.label ?? item.market.symbol}</span>
                      <span className="block truncate text-xs text-[#8b95a1]">
                        {item.why}
                        {item.relation?.latest_check?.status ? ` · ${item.relation.latest_check.status}` : ""}
                      </span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums text-white">
                      {item.market.odds_pct != null ? `${item.market.odds_pct.toFixed(0)}%` : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

async function SideBySide({
  aSym,
  bSym,
  relations,
}: {
  aSym: string;
  bSym: string;
  relations: Relation[];
}) {
  // Re-pull both books from Gemini so the comparison uses current bids/asks.
  const [detailA, detailB] = await Promise.all([
    getMarket(aSym, { refresh: true }),
    getMarket(bSym, { refresh: true }),
  ]);
  if (!detailA || !detailB) {
    return (
      <main className="relative mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-8">
        <Link href="/compare" className="text-sm font-medium text-[#9aebff] hover:underline">← Compare</Link>
        <p className="mt-6 text-sm text-[#8b95a1]">
          Could not load live Gemini books for this pair. They may not be graded yet — leave the recorder running.
        </p>
      </main>
    );
  }
  const left = detailA;
  const right = detailB;
  const shared = sharedRelation(relations, left.symbol, right.symbol);
  const violated =
    shared?.verified &&
    (shared.latest_check?.status === "executable" || shared.latest_check?.status === "theoretical_only");
  const story = shared
    ? relationStory(shared.kind, shared.latest_check?.status, shared.verified)
    : null;
  const leftVerdict = assess(left, Boolean(violated));
  const rightVerdict = assess(right, Boolean(violated));

  return (
    <main className="relative mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-8">
      <Link
        href={`/compare?symbol=${encodeURIComponent(left.symbol)}`}
        className="text-sm font-medium text-[#9aebff] hover:underline"
      >
        ← Pick another pair
      </Link>
      <div className="mt-4 max-w-2xl pr-28 sm:pr-36">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Side-by-side comparison</h1>
        <p className="mt-2 text-[#9aa3ad]">
          Fresh Gemini order books for both contracts. A disagreement is not a claim about intent.
        </p>
      </div>
      <p className="mt-2 text-xs text-[#8b95a1]">
        Observed {new Date(left.updated_at * 1000).toLocaleString()} and {new Date(right.updated_at * 1000).toLocaleString()}.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <MarketPanel market={left} verdictTitle={leftVerdict.title} verdictReason={leftVerdict.reason} accent="#28cc95" />
        <MarketPanel market={right} verdictTitle={rightVerdict.title} verdictReason={rightVerdict.reason} accent="#4c8dff" />
      </div>

      <section className="mt-5 rounded-[24px] border border-white/10 bg-[#12141a] p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-white">Head-to-head</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-white/10 text-[#8b95a1]">
              <tr>
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 pr-3 font-medium">{left.label ?? left.symbol}</th>
                <th className="py-2 font-medium">{right.label ?? right.symbol}</th>
              </tr>
            </thead>
            <tbody className="text-[#d7dde4]">
              <Row label="YES" a={pct(left.odds_pct)} b={pct(right.odds_pct)} />
              <Row label="Depth grade" a={left.grade} b={right.grade} />
              <Row label="Cost to move 10¢" a={usd(left.move_cost_usd)} b={usd(right.move_cost_usd)} />
              <Row label="Spread" a={spread(left.spread_c)} b={spread(right.spread_c)} />
              <Row
                label="Depth in 10¢ window"
                a={depth(left)}
                b={depth(right)}
              />
              <Row label="Reading" a={leftVerdict.title} b={rightVerdict.title} />
              {shared?.latest_check && (
                <>
                  <Row
                    label="Quoted in check"
                    a={pct(shared.latest_check.prices_c?.[left.symbol] ?? null)}
                    b={pct(shared.latest_check.prices_c?.[right.symbol] ?? null)}
                  />
                  <Row
                    label="Nearest coherent"
                    a={pct(shared.latest_check.coherent_c?.[left.symbol] ?? null)}
                    b={pct(shared.latest_check.coherent_c?.[right.symbol] ?? null)}
                  />
                </>
              )}
            </tbody>
          </table>
        </div>

        {story && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-[#1a1d24] p-4">
            <div className="flex flex-wrap items-center gap-2">
              {shared?.verified ? (
                <span className="rounded-full bg-[#12382c] px-2.5 py-0.5 text-xs font-semibold text-[#8ee0b0]">Verified rule</span>
              ) : (
                <span className="rounded-full bg-[#3a2c12] px-2.5 py-0.5 text-xs font-semibold text-[#ffc46b]">Suggested only</span>
              )}
              <StatusPill status={shared?.latest_check?.status ?? "pending"} />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{story.title}</p>
            <p className="mt-1 text-sm text-[#c5ced6]">{story.body}</p>
            {shared?.latest_check?.summary && (
              <p className={`mt-2 text-sm ${violated ? "text-[#ff8b98]" : "text-[#9aa3ad]"}`}>
                {shared.latest_check.summary}
                {shared.latest_check.gap_c > 0 ? ` · gap ${shared.latest_check.gap_c.toFixed(1)} pts` : ""}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[24px] border border-white/10 bg-[#12141a] p-5">
        <h2 className="text-lg font-semibold text-white">Odds over time</h2>
        <div className="mt-4">
          <LiveDualOddsChart
            series={[
              { market: left, points: left.history, stroke: "#28cc95", label: left.label ?? left.symbol },
              { market: right, points: right.history, stroke: "#4c8dff", label: right.label ?? right.symbol },
            ]}
          />
        </div>
      </section>
    </main>
  );
}

function MarketPanel({
  market,
  verdictTitle,
  verdictReason,
  accent,
}: {
  market: Market | MarketDetail;
  verdictTitle: string;
  verdictReason: string;
  accent: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[#12141a] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#8b95a1]">{market.category ?? "Market"}</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white">{market.event_title}</h2>
          <p className="mt-1 text-sm text-[#c5ced6]">{market.label}</p>
        </div>
        <GradePill grade={market.grade} size="lg" />
      </div>
      <p className="mt-5 text-4xl font-semibold tabular-nums text-white" style={{ textShadow: `0 0 40px ${accent}33` }}>
        {market.odds_pct != null ? `${market.odds_pct.toFixed(0)}%` : "—"}
      </p>
      <p className="mt-1 text-sm text-[#9aa3ad]">
        {verdictTitle} · {usd(market.move_cost_usd)} to move 10¢
      </p>
      <p className="mt-3 text-sm leading-snug text-[#c5ced6]">{verdictReason}</p>
      <Link
        href={`/market/${encodeURIComponent(market.symbol)}`}
        className="mt-4 inline-block text-sm font-medium text-white underline decoration-white/30 underline-offset-4"
      >
        Open market
      </Link>
    </article>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-white/[0.06]">
      <td className="py-2.5 pr-3 text-[#8b95a1]">{label}</td>
      <td className="py-2.5 pr-3 font-medium tabular-nums text-white">{a}</td>
      <td className="py-2.5 font-medium tabular-nums text-white">{b}</td>
    </tr>
  );
}

function pct(n: number | null | undefined): string {
  return n != null ? `${Number(n).toFixed(1)}%` : "—";
}

function spread(n: number | null | undefined): string {
  return n != null ? `${n}¢` : "—";
}

function depth(m: Market | MarketDetail): string {
  const d = m.score?.depth_pct;
  return d != null ? `${Math.round(d)}% of side` : "—";
}

function rankMarkets(markets: Market[]): Market[] {
  return [...markets].sort((a, b) => (b.odds_pct ?? -1) - (a.odds_pct ?? -1) || b.move_cost_usd - a.move_cost_usd);
}

type SimilarItem = { market: Market; why: string; relation?: Relation };

function findSimilar(selected: Market, markets: Market[], relations: Relation[]): SimilarItem[] {
  const out: SimilarItem[] = [];
  const seen = new Set<string>([selected.symbol]);

  for (const r of relations) {
    if (!r.members.includes(selected.symbol)) continue;
    for (const sym of r.members) {
      if (seen.has(sym)) continue;
      const m = markets.find((x) => x.symbol === sym);
      if (!m) continue;
      seen.add(sym);
      out.push({
        market: m,
        why: r.verified ? kindWhy(r.kind) : `Suggested · ${kindWhy(r.kind)}`,
        relation: r,
      });
    }
  }

  // Same-event siblings not already covered by a relation
  for (const m of markets) {
    if (seen.has(m.symbol)) continue;
    const sameEvent =
      (selected.event_slug && m.event_slug === selected.event_slug) ||
      (selected.event_title && m.event_title === selected.event_title);
    if (!sameEvent) continue;
    seen.add(m.symbol);
    out.push({ market: m, why: "Same event" });
  }

  return out.slice(0, 30);
}

function kindWhy(kind: string): string {
  if (kind === "threshold_ladder") return "Same ladder · higher threshold";
  if (kind === "time_ladder") return "Same event · different deadline";
  if (kind === "exclusive" || kind === "exclusive_exhaustive") return "Same race · other outcome";
  return "Related contract";
}

function sharedRelation(relations: Relation[], a: string, b: string): Relation | null {
  const hits = relations.filter((r) => r.members.includes(a) && r.members.includes(b));
  if (hits.length === 0) return null;
  return (
    hits.find((r) => {
      const s = r.latest_check?.status;
      return r.verified && (s === "executable" || s === "theoretical_only");
    }) ??
    hits.find((r) => r.verified) ??
    hits[0]
  );
}

function pickPairFromRelation(rel: Relation | undefined, bySymbol: Map<string, Market>): [Market, Market] | null {
  if (!rel) return null;
  const priced = rel.members.map((s) => bySymbol.get(s)).filter((m): m is Market => Boolean(m));
  if (priced.length >= 2) return [priced[0], priced[1]];
  return null;
}
