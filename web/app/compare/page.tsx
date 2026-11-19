import Link from "next/link";
import { DualOddsChart } from "@/components/MoveCostChart";
import { RelationGraph } from "@/components/RelationGraph";
import { getMarket, getRelations, type MarketDetail, type Relation } from "@/lib/api";
import { assess, relationStory } from "@/lib/verdict";

export default async function ComparePage(props: { searchParams: Promise<{ symbol?: string; relation?: string }> }) {
  const sp = await props.searchParams;
  const symbol = typeof sp.symbol === "string" ? sp.symbol : "";
  const relationId = typeof sp.relation === "string" ? sp.relation : "";
  const data = await getRelations();
  const relations = data?.relations ?? [];
  const group = pickGroup(relations, symbol, relationId);
  const members = group ? await loadMembers(group.members) : [];
  const story = group ? relationStory(group.kind, group.latest_check?.status, group.verified) : null;
  const violated = group?.latest_check?.status === "executable" || group?.latest_check?.status === "theoretical_only";

  return (
    <main className="mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-8">
      <Link href="/" className="text-sm font-medium text-[#9aebff] hover:underline">All markets</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Market comparison lab</h1>
      <p className="mt-2 max-w-2xl text-[#9aa3ad]">
        Related contracts, side by side. A disagreement is called only after the settlement rule for that group has been checked. It is not a claim about intent.
      </p>

      {!group && (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {relations.filter((r) => r.verified).slice(0, 12).map((r) => (
            <li key={r.id}>
              <Link href={`/compare?relation=${encodeURIComponent(r.id)}`} className="block rounded-2xl border border-white/10 bg-[#12141a] p-4 hover:border-white/30">
                <span className="font-medium text-white">{r.note || r.id}</span>
                <span className="mt-1 block text-sm text-[#9aa3ad]">{r.latest_check?.status ?? "not checked yet"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {symbol && !group && (
        <p className="mt-8 text-sm text-[#9aa3ad]">No related contracts are on file for this market yet.</p>
      )}

      {group && story && (
        <section className="mt-8 rounded-[24px] border border-white/10 bg-[#12141a] p-6">
          {!group.verified && (
            <p className="mb-4 rounded-xl border border-[#d7a15a] bg-[#2a2116] p-3 text-sm text-[#f0d7a8]">
              Possible relationship only. Someone still has to read the contract rules before this group can confirm an inconsistency.
            </p>
          )}
          {group.source === "synthetic" && (
            <p className="mb-4 text-sm text-[#f0d7a8]">Synthetic replay. These books were not read from Gemini.</p>
          )}
          <h2 className="text-xl font-semibold text-white">{story.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c5ced6]">{story.body}</p>
          <div className="mt-6">
            <RelationGraph
              verified={group.verified}
              violated={Boolean(group.verified && violated)}
              edge={edgeLabel(group.kind)}
              nodes={members.map((m) => ({
                symbol: m.symbol,
                label: m.label ?? m.symbol,
                event: m.event_title ?? "",
                pct: m.odds_pct != null ? `${m.odds_pct.toFixed(0)}%` : "—",
                verdict: assess(m, Boolean(group.verified && violated)).title,
              }))}
            />
          </div>
          <div className="mt-6">
            <DualOddsChart
              series={members.slice(0, 2).map((m, i) => ({
                points: m.history,
                stroke: i === 0 ? "#28cc95" : "#4c8dff",
                label: m.label ?? m.symbol,
              }))}
            />
            <p className="mt-1 text-xs text-[#8b95a1]">Stored YES odds for the first two contracts in this group.</p>
          </div>
        </section>
      )}
    </main>
  );
}

function edgeLabel(kind: string): string {
  if (kind === "threshold_ladder") return "Higher threshold cannot be more likely";
  if (kind === "time_ladder") return "Earlier deadline cannot be more likely";
  if (kind === "exclusive_exhaustive") return "Exactly one outcome";
  if (kind === "exclusive") return "At most one outcome";
  return kind;
}

function pickGroup(relations: Relation[], symbol: string, relationId: string): Relation | undefined {
  if (relationId) return relations.find((r) => r.id === relationId);
  const hits = relations.filter((r) => r.members.includes(symbol));
  return hits.find((r) => r.verified) ?? hits[0];
}

async function loadMembers(symbols: string[]): Promise<MarketDetail[]> {
  const out: MarketDetail[] = [];
  for (const symbol of symbols.slice(0, 8)) {
    const market = await getMarket(symbol);
    if (market) out.push(market);
  }
  return out;
}
