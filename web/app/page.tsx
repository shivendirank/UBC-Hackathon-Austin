import type { ReactNode } from "react";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { FeaturedBoard } from "@/components/FeaturedBoard";
import { ForecastBar } from "@/components/ForecastBar";
import { findMarket, getMarket, getMarkets, getRelations, type HistoryPoint, type Market } from "@/lib/api";
import { groupEvents, mixBoards } from "@/lib/events";
import { bookStatus } from "@/lib/status";
import { inconsistentSymbols } from "@/lib/verdict";

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";

  const data = await getMarkets({ sort: "deep", limit: 500 });
  const all = data?.markets ?? [];
  const categories = [...new Set(all.map((m) => m.category).filter((c): c is string => Boolean(c)))].sort();

  let markets = all.filter((m) => bookStatus(m) !== "Empty");
  if (category) markets = markets.filter((m) => m.category === category);
  if (q) {
    const needle = q.toLowerCase();
    markets = all.filter((m) =>
      [m.event_title, m.label, m.symbol, m.category].some((v) => v?.toLowerCase().includes(needle)),
    );
  }

  let direct: Market | null = null;
  if (q.length > 2) {
    direct = await findMarket(q);
    if (direct && !markets.some((m) => m.symbol === direct!.symbol)) markets = [direct, ...markets];
  }

  const relations = await getRelations();
  const inconsistent = inconsistentSymbols(relations?.relations ?? []);
  const quoted = all.filter((m) => bookStatus(m) !== "Empty" && m.odds_pct != null);
  const forecasts = mixBoards(groupEvents(quoted)).slice(0, 18).map((b) => ({
    href: `/market/${encodeURIComponent(b.markets[0].symbol)}`,
    title: b.title,
    pct: b.markets[0].odds_pct ?? 0,
  }));
  const boards = mixBoards(groupEvents(markets));
  const featured = boards[0];
  const rest = boards.slice(1);
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
      <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.03em] text-white sm:text-5xl">
        Explore predictions. Understand what&apos;s behind the odds.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#9aa3ad] sm:text-base">
        The percent is the displayed price. Thin Ice reads the order book behind it and checks whether related contracts agree. It does not place trades.
      </p>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10 text-[13px]" aria-label="Categories">
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

      {markets.some((m) => m.synthetic || m.event_title?.includes("Synthetic replay")) && (
        <p className="mt-4 rounded-2xl border border-[#f0d7a8] bg-[#2a2116] px-4 py-3 text-sm text-[#f0d7a8]">
          Cards marked demo replay were written for this demo. They are not live Gemini quotes.
        </p>
      )}

      {boards.length === 0 ? (
        <p className="mt-10 text-sm text-[#8b95a1]">No markets match that search.</p>
      ) : (
        <>
          {featured && <div className="mt-6"><FeaturedBoard board={featured} histories={histories} inconsistent={inconsistent} /></div>}
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rest.map((b) => <EventCard key={b.key} board={b} inconsistent={inconsistent} />)}
          </div>
        </>
      )}

      <p className="mt-8 text-sm">
        <Link href="/watch" className="font-medium text-[#9aebff] hover:underline">Open your watchlist</Link>
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
