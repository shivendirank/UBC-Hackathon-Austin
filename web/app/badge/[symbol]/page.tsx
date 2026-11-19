import { getMarket, usd } from "@/lib/api";

// Embeddable badge: <iframe src="https://<host>/badge/<symbol>" width="320" height="72">
export default async function Badge(props: PageProps<"/badge/[symbol]">) {
  const { symbol } = await props.params;
  const m = await getMarket(decodeURIComponent(symbol));
  if (!m) return <p className="p-3 text-sm">Thin Ice: market not graded</p>;
  const status = m.status ?? (m.score.mid_c == null ? "Empty" : m.score.exhausted ? "Runs out" : "OK");
  return (
    <a
      href={`/market/${encodeURIComponent(m.symbol)}`}
      target="_blank"
      className="flex items-center gap-3 p-3 text-sm"
    >
      <span>
        {m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "No price"}
        <span className="block text-neutral-700 dark:text-neutral-300">
          {status === "Empty" ? "Empty" : `Grade ${m.grade} · ${status} · ${usd(m.move_cost_usd)}`}
        </span>
      </span>
    </a>
  );
}
