import type { ReactNode } from "react";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { FeaturedBoard } from "@/components/FeaturedBoard";
import { ForecastBar } from "@/components/ForecastBar";
import { findMarket, getMarket, getMarkets, getRelations, type HistoryPoint, type Market } from "@/lib/api";
import { groupEvents, mixBoards } from "@/lib/events";
import { bookStatus } from "@/lib/status";
import { freshnessRank, inconsistentSymbols } from "@/lib/verdict";

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";

  const data = await getMarkets({ sort: "deep", limit: 500 });
  const all = data?.markets ?? [];
  const categories = [...new Set(all.map((m) => m.category).filter((c): c is string => Boolean(c)))].sort();

  const isDemo = (m: Market) => Boolean(m.synthetic || m.event_title?.includes("Synthetic replay"));
  // Prefer live → recent → aging → archived so the board leads with usable readings.
  const byFreshness = (a: Market, b: Market) =>
    freshnessRank(b.updated_at) - freshnessRank(a.updated_at) || a.move_cost_usd - b.move_cost_usd;
  let markets = all
    .filter((m) => bookStatus(m) !== "Empty" && !isDemo(m))
    .sort(byFreshness);
  if (category) markets = markets.filter((m) => m.category === category);
  if (q) {
    const needle = q.toLowerCase();
    markets = all
      .filter(
        (m) =>
          !isDemo(m) &&
          bookStatus(m) !== "Empty" &&
          [m.event_title, m.label, m.symbol, m.category].some((v) => v?.toLowerCase().includes(needle)),
      )
      .sort(byFreshness);
  }

  let direct: Market | null = null;
  if (q.length > 2) {
    direct = await findMarket(q);
    if (direct && !markets.some((m) => m.symbol === direct!.symbol)) markets = [direct, ...markets];
  }

  const relationsData = await getRelations();
  const relations = relationsData?.relations ?? [];
  const inconsistent = inconsistentSymbols(relations);
  const quoted = all.filter((m) => bookStatus(m) !== "Empty" && m.odds_pct != null && !isDemo(m));
  const forecasts = mixBoards(groupEvents(quoted)).slice(0, 18).map((b) => ({
    href: `/market/${encodeURIComponent(b.markets[0].symbol)}`,
    title: b.title,
    pct: b.markets[0].odds_pct ?? 0,
  }));
  // Freshest event leads the hero; mix the rest so one category cannot fill the grid.
  const grouped = groupEvents(markets);
  const featured = grouped[0];
  const rest = mixBoards(grouped.slice(1));
  const histories: HistoryPoint[][] = [];
  if (featured) {
    for (const m of featured.markets.slice(0, 2)) {
      histories.push((await getMarket(m.symbol))?.history ?? []);
    }
  }

  return (
    <>
    <ForecastBar items={forecasts} />
    <main className="mx-auto w-full max-w-[1680px] px-6 py-6 lg:px-8">
      <nav className="flex gap-1 overflow-x-auto text-[13px] font-medium" aria-label="Categories">
        <Chip href={q ? `/?q=${encodeURIComponent(q)}` : "/"} active={!category}>All</Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            href={`/?category=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            active={category === c}
          >
            {c}
          </Chip>
        ))}
      </nav>

      {!data && (
        <p className="mt-8 rounded-2xl border border-[#f0d7a8] bg-[#2a2116] p-4 text-sm text-[#f0d7a8]">
          Can&apos;t reach the Thin Ice API. Start it with uvicorn in backend/.
        </p>
      )}

      {grouped.length === 0 ? (
        <p className="mt-10 text-sm text-[#8b95a1]">No markets match that search.</p>
      ) : (
        <>
          {featured && (
            <div className="mt-6">
              <FeaturedBoard board={featured} histories={histories} inconsistent={inconsistent} relations={relations} />
            </div>
          )}
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rest.map((b) => <EventCard key={b.key} board={b} inconsistent={inconsistent} relations={relations} />)}
          </div>
        </>
      )}

      <p className="mt-8 text-sm text-[#8b95a1]">
        Star markets to save them.{" "}
        <Link href="/watch" className="font-medium text-[#9aebff] hover:underline">
          Open your watchlist
        </Link>{" "}
        (sign in required).
      </p>
    </main>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 border-b-2 px-3 py-2.5 ${active ? "border-white font-medium text-white" : "border-transparent text-[#8b95a1] hover:text-white"}`}
    >
      {children}
    </Link>
  );
}
