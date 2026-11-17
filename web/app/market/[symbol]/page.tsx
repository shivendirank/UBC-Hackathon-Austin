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
        <Stat label="One-fill price set" value={s.spoof_cost_usd != null ? usd(s.spoof_cost_usd) : "–"} />
      </dl>

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
