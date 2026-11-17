import { GradePill } from "@/components/GradePill";
import { getMarket, usd } from "@/lib/api";

// Embeddable badge: <iframe src="https://<host>/badge/<symbol>" width="320" height="72">
export default async function Badge(props: PageProps<"/badge/[symbol]">) {
  const { symbol } = await props.params;
  const m = await getMarket(decodeURIComponent(symbol));
  if (!m) return <p className="p-3 text-sm">Thin Ice: market not graded</p>;
  return (
    <a
      href={`/market/${encodeURIComponent(m.symbol)}`}
      target="_blank"
      className="flex items-center gap-3 p-3 text-sm"
    >
      <GradePill grade={m.grade} />
      <span>
        {m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "–"} · moves 10¢ for <strong>{usd(m.move_cost_usd)}</strong>
        <span className="block text-xs text-neutral-500">Thin Ice grade · liquidity, not intent</span>
      </span>
    </a>
  );
}
