import Link from "next/link";
import { notFound } from "next/navigation";
import { GradePill } from "@/components/GradePill";
import { MoveCostChart } from "@/components/MoveCostChart";
import { API_URL, getMarket, usd } from "@/lib/api";

export default async function MarketPage(props: PageProps<"/market/[symbol]">) {
  const { symbol } = await props.params;
  const m = await getMarket(decodeURIComponent(symbol));
  if (!m) notFound();
  const s = m.score;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-sky-600 hover:underline">← All markets</Link>
      <p className="mt-6 text-sm text-neutral-500">{m.event_title}</p>
      <h1 className="text-2xl font-bold">{m.label}</h1>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <GradePill grade={m.grade} large />
        <span className="text-lg">
          {m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "No price"} · moves 10¢ for{" "}
          <strong>{usd(m.move_cost_usd)}</strong>
        </span>
      </div>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">{m.grade_words}</p>
      {s.reasons.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          {s.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Push up 10¢" value={usd(s.cost_up_usd)} />
        <Stat label="Push down 10¢" value={usd(s.cost_down_usd)} />
        <Stat label="Spread" value={s.spread_c != null ? `${s.spread_c}¢` : "–"} />
        <Stat label="One-fill price set" value={s.spoof_cost_usd == null ? "–" : s.spoof_cost_usd < 0.01 ? "under 1¢" : usd(s.spoof_cost_usd)} />
      </dl>

      {m.liquidity && (
        <>
          <h2 className="mt-10 text-lg font-semibold">How strong is this market?</h2>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">{m.liquidity.summary}</p>
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
                  <td className="py-1 pr-2 tabular-nums">{f.avg_price_c != null ? `${f.avg_price_c.toFixed(1)}¢` : "–"}</td>
                  <td className="py-1 pr-2 tabular-nums">{f.slippage_c != null ? `${f.slippage_c.toFixed(1)}¢` : "–"}</td>
                  <td className="py-1">{f.complete ? "Yes" : `No, only ${usd(f.filled_usd)} visible`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.resilience.share_thin != null && (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              Thin (under $100 to move 10¢) for {(m.resilience.share_thin * 100).toFixed(0)}% of the recorded time;
              longest stretch {Math.round((m.resilience.longest_thin_s ?? 0) / 60)} min.
            </p>
          )}
        </>
      )}

      {m.relations.length > 0 && (
        <p className="mt-6 text-sm">
          Part of {m.relations.length} consistency check{m.relations.length > 1 ? "s" : ""}.{" "}
          <Link href="/relations" className="text-sky-600 hover:underline">See consistency</Link>
        </p>
      )}

      <h2 className="mt-10 text-lg font-semibold">Cost to move, over time</h2>
      <MoveCostChart points={m.history} />

      <h2 className="mt-10 text-lg font-semibold">Receipts</h2>
      {m.receipts.length === 0 ? (
        <p className="text-sm text-neutral-500">No receipts yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {m.receipts.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <GradePill grade={r.grade} />
              <span>{new Date(r.ts * 1000).toLocaleString()}</span>
              <a className="text-sky-600 hover:underline" href={`${API_URL}/api/snapshots/${r.snapshot_hash}.json`}>
                snapshot {r.snapshot_hash.slice(0, 10)}…
              </a>
              {r.explorer_url && <a className="text-sky-600 hover:underline" href={r.explorer_url}>Solana Explorer</a>}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold">Embed</h2>
      <code className="mt-2 block overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {`<iframe src="/badge/${encodeURIComponent(m.symbol)}" width="320" height="72" style="border:0"></iframe>`}
      </code>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
