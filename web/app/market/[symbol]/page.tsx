import Link from "next/link";
import { notFound } from "next/navigation";
import { GradePill } from "@/components/GradePill";
import { MoveCostChart, OddsChart } from "@/components/MoveCostChart";
import { Sticker } from "@/components/Stickers";
import { WatchButton } from "@/components/WatchButton";
import { apiBase, getIncidents, getMarket, getMarkets, getRelations, usd } from "@/lib/api";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { assess, relatedCheck, relationStory } from "@/lib/verdict";

export default async function MarketPage(props: PageProps<"/market/[symbol]">) {
  const { symbol } = await props.params;
  const m = await getMarket(decodeURIComponent(symbol));
  if (!m) notFound();
  const s = m.score;
  const notes = plainReasons(s.reasons);
  const synthetic = m.synthetic || m.event_title?.includes("Synthetic replay");
  const relationsData = await getRelations();
  const allRelations = relationsData?.relations ?? [];
  const related = allRelations.filter((r) => r.members.includes(m.symbol));
  const focusRelation = relatedCheck(allRelations, m.symbol);
  const verifiedBreak = related.find((r) => r.verified && (r.latest_check?.status === "executable" || r.latest_check?.status === "theoretical_only"));
  const verdict = assess(m, Boolean(verifiedBreak));
  const incidents = await getIncidents();
  const investigation = (incidents?.incidents ?? []).find((i) => i.subject === m.symbol || i.subject === verifiedBreak?.id);
  const list = await getMarkets({ sort: "deep", limit: 500 });
  const siblings = (list?.markets ?? []).filter((x) =>
    (m.event_slug && x.event_slug === m.event_slug) || x.event_title === m.event_title,
  );
  const others = siblings.filter((x) => x.symbol !== m.symbol).slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-[1680px] px-6 py-6 lg:px-8">
      <Link href="/" className="text-sm font-medium text-[#9aebff] hover:underline">All markets</Link>
      <section className="mt-4 rounded-[24px] surface-card p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <div className="group flex items-start gap-3">
              <Sticker category={m.category} title={m.event_title} ticker={m.event_ticker} className="h-11 w-11 shrink-0" animated />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-white">{m.event_title}</h1>
                  <FreshnessBadge updatedAt={m.updated_at} />
                </div>
                <p className="mt-1 text-sm text-[#8b95a1]">{m.category}</p>
              </div>
            </div>
            {synthetic && (
              <p className="mt-4 rounded-lg border border-amber-400 bg-[#2a2116] p-3 text-sm text-[#f0d7a8]">
                Synthetic replay. This order book was written for the demo. It was not read from Gemini.
              </p>
            )}
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span className="block text-sm font-medium text-[#d7dde4]">{m.label}</span>
                  <span className="mt-1 block text-xs text-[#8b95a1]">YES</span>
                  <span className="mt-1 block text-4xl font-bold tabular-nums tracking-tight text-white">{m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "—"}</span>
                </div>
                <div className="text-right">
                  <GradePill grade={m.grade} size="lg" />
                  <span className="mt-1 block text-xs text-[#8b95a1]">Depth grade</span>
                </div>
              </div>
              <span className="mt-2 block text-sm text-[#9aa3ad]">
                {verdict.title}
                {verdict.freshness !== "live" && verdict.kind !== "insufficient" ? ` · ${verdict.ageLabel}` : ""}
                {" · "}
                {usd(m.move_cost_usd)} to move 10¢
              </span>
            </div>
            <p className="mt-3 text-sm text-[#c5ced6]">{verdict.reason}</p>
            {focusRelation?.latest_check && (
              <p className={`mt-2 text-sm ${verifiedBreak ? "text-[#ff8b98]" : "text-[#9aa3ad]"}`}>
                Compared with related markets: {focusRelation.latest_check.summary}
              </p>
            )}
            <p className="mt-2 text-xs text-[#8b95a1]">Order book observed {new Date(m.updated_at * 1000).toLocaleString()}. The YES percent is the mid of that book.</p>
            {notes.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-[#8b95a1]">
                {notes.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={focusRelation ? `/compare?relation=${encodeURIComponent(focusRelation.id)}` : `/compare?symbol=${encodeURIComponent(m.symbol)}`}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#101216]"
              >
                {verifiedBreak ? "See inconsistency" : "Compare related"}
              </Link>
              <a href="#evidence" className="rounded-full bg-[#22262d] px-3 py-1.5 text-sm text-white">Investigate</a>
              <WatchButton symbol={m.symbol} />
              <a href="#verify" className="rounded-full bg-[#22262d] px-3 py-1.5 text-sm text-white">Verify</a>
            </div>
          </div>
          <div className="min-w-0">
            <OddsChart points={m.history} />
          </div>
        </div>
        {others.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-[#9aa3ad]">Same event · grades and odds</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {others.map((x) => (
                <li key={x.symbol}>
                  <Link href={`/market/${encodeURIComponent(x.symbol)}`} className="flex items-center justify-between gap-3 rounded-xl bg-[#1a1d22] px-3 py-2 hover:bg-[#22262d]">
                    <span className="flex min-w-0 items-center gap-2">
                      <GradePill grade={x.grade} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">{x.label}</span>
                        <span className="text-xs text-[#8b95a1]">{assess(x).title}</span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-white">
                      {x.odds_pct != null ? `${x.odds_pct.toFixed(0)}%` : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section id="evidence" className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[20px] surface-card p-5">
          <h2 className="text-lg font-semibold">Why this reading</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#c5ced6]">
            {verdict.evidence.map((line) => <li key={line}>{line}</li>)}
            {m.alerts.some((a) => a.kind === "unusual_move") && (
              <li>The odds moved at least 10¢ within 10 minutes while the book was thin.</li>
            )}
            {s.spread_c != null && s.spread_c > 10 && <li>The bid/ask spread is {s.spread_c}¢.</li>}
            {notes.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </article>
        <article id="history" className="rounded-[20px] surface-card p-5">
          <h2 className="text-lg font-semibold">Price and liquidity history</h2>
          <p className="mt-1 text-sm text-[#9aa3ad]">Stored observations only.</p>
          <div className="mt-3">
            <OddsChart points={m.history} />
          </div>
          <MoveCostChart points={m.history} />
        </article>
        <article className="rounded-[20px] surface-card p-5">
          <h2 className="text-lg font-semibold">Investigation</h2>
          {!investigation ? (
            <p className="mt-2 text-sm text-[#9aa3ad]">No Grok Bot investigation has been filed for this contract.</p>
          ) : (
            <div className="mt-2 space-y-2 text-sm text-[#c5ced6]">
              <p>Status: {investigation.status}.</p>
              {investigation.report ? (
                <>
                  <p>{investigation.report.summary}</p>
                  <p className="text-[#9aa3ad]">Filed by {investigation.report.author}. Sources are listed with the incident.</p>
                </>
              ) : (
                <p>Waiting for a report. Thin Ice has not written findings for this case.</p>
              )}
              <Link href={`/incidents/${investigation.id}`} className="inline-block text-white underline decoration-white/30 underline-offset-4">Open the incident</Link>
            </div>
          )}
        </article>
        <article className="rounded-[20px] surface-card p-5">
          <h2 className="text-lg font-semibold">What you can do</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href={`/compare?symbol=${encodeURIComponent(m.symbol)}`} className="text-white underline decoration-white/30 underline-offset-4">Compare related markets</Link></li>
            <li><a href="#history" className="text-white underline decoration-white/30 underline-offset-4">Review liquidity history</a></li>
            <li><a href="#advanced" className="text-white underline decoration-white/30 underline-offset-4">Inspect the supporting numbers</a></li>
          </ul>
          <div className="mt-4"><WatchButton symbol={m.symbol} /></div>
          {related[0] && (
            <p className="mt-4 text-sm text-[#9aa3ad]">{relationStory(related[0].kind, related[0].latest_check?.status, related[0].verified).body}</p>
          )}
        </article>
      </section>

      <details id="advanced" className="mt-8 rounded-[20px] surface-card p-5">
        <summary className="cursor-pointer text-lg font-semibold">Advanced details</summary>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Stat label="Push up 10¢" value={usd(s.cost_up_usd)} />
          <Stat label="Push down 10¢" value={usd(s.cost_down_usd)} />
          <Stat label="Spread" value={s.spread_c != null ? `${s.spread_c}¢` : "—"} />
        </dl>
        {m.liquidity && (
          <>
            <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300">{m.liquidity.summary}</p>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="py-1 pr-2">Trade</th>
                  <th className="py-1 pr-2">Average price</th>
                  <th className="py-1 pr-2">Worse than quote by</th>
                  <th className="py-1">Fills?</th>
                </tr>
              </thead>
              <tbody>
                {m.liquidity.fills.map((f) => (
                  <tr key={`${f.side}-${f.target_usd}`} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-1 pr-2">{f.side === "buy_yes" ? "Buy" : "Sell"} {usd(f.target_usd)}</td>
                    <td className="py-1 pr-2 tabular-nums">{f.avg_price_c != null ? `${f.avg_price_c.toFixed(1)}¢` : "—"}</td>
                    <td className="py-1 pr-2 tabular-nums">{f.slippage_c != null ? `${f.slippage_c.toFixed(1)}¢` : "—"}</td>
                    <td className="py-1">{f.complete ? "Yes" : `No, only ${usd(f.filled_usd)} visible`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <h3 className="mt-6 font-semibold">Cost to move, over time</h3>
        <MoveCostChart points={m.history} />
      </details>

      <section id="verify" className="mt-10 rounded-2xl surface-inset p-4">
        <h2 className="text-lg font-semibold">Verify assessment</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          A receipt pins Thin Ice&apos;s reading of the book. It does not prove Gemini&apos;s market data by itself.
        </p>
        {m.snapshot_hash && (
          <p className="mt-2 text-sm">
            Snapshot{" "}
            <a className="text-sky-700 hover:underline dark:text-sky-400" href={`${apiBase()}/api/snapshots/${m.snapshot_hash}.json`}>
              {m.snapshot_hash.slice(0, 12)}…
            </a>
          </p>
        )}
        {m.receipts.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No receipt has been published for this market yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {m.receipts.map((r) => (
              <li key={r.id}>
                {new Date(r.ts * 1000).toLocaleString()}{" "}
                <a className="text-sky-700 hover:underline dark:text-sky-400" href={`${apiBase()}/api/snapshots/${r.snapshot_hash}.json`}>snapshot</a>
                {r.explorer_url && <> <a className="text-sky-700 hover:underline dark:text-sky-400" href={r.explorer_url}>Solana</a></>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function plainReasons(reasons: string[]): string[] {
  const out: string[] = [];
  for (const r of reasons) {
    if (r === "no trades on record" || r.startsWith("No trades have been recorded")) {
      out.push("No trades have been recorded for this contract yet.");
    } else if (r === "no trade in the last 24 hours" || r.startsWith("No trade in the last 24 hours")) {
      out.push("No trade in the last 24 hours.");
    } else if (r.startsWith("one-sided")) {
      out.push("One side of the book is empty.");
    }
  }
  return [...new Set(out)];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
