import Link from "next/link";
import { GradePill } from "@/components/GradePill";
import { getMarkets, usd } from "@/lib/api";

export default async function Home() {
  const data = await getMarkets();
  const markets = data?.markets ?? [];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Thin Ice</h1>
      <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
        How much money would it take to move these odds by 10 cents? Live grades for Gemini prediction
        markets, from their public order books. Grades describe liquidity, not intent.
      </p>

      {!data && (
        <p className="mt-8 rounded-lg border border-amber-400 p-4 text-sm">
          Can&apos;t reach the Thin Ice API. Start it with <code>uvicorn thin_ice.api:app</code> in <code>backend/</code>.
        </p>
      )}

      <table className="mt-8 w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>
            <th className="py-2 pr-2">Market</th>
            <th className="py-2 pr-2">Odds</th>
            <th className="py-2 pr-2">Moves 10¢ for</th>
            <th className="py-2 pr-2">Spread</th>
            <th className="py-2">Grade</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => (
            <tr key={m.symbol} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-2 pr-2">
                <Link href={`/market/${encodeURIComponent(m.symbol)}`} className="hover:underline">
                  <span className="font-medium">{m.label}</span>
                  <span className="block text-xs text-neutral-500">{m.event_title}</span>
                </Link>
              </td>
              <td className="py-2 pr-2 tabular-nums">{m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "–"}</td>
              <td className="py-2 pr-2 tabular-nums">
                {m.odds_pct == null ? <span className="text-neutral-500">One-sided book</span> : usd(m.move_cost_usd)}
              </td>
              <td className="py-2 pr-2 tabular-nums">{m.spread_c != null ? `${m.spread_c}¢` : "–"}</td>
              <td className="py-2"><GradePill grade={m.grade} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
