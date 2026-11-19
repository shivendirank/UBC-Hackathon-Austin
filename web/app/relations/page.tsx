import { StatusPill } from "@/components/StatusPill";
import { getRelations } from "@/lib/api";

const KIND_WORDS: Record<string, string> = {
  threshold_ladder: "Price ladder (higher threshold can't be more likely)",
  time_ladder: "Deadline ladder (earlier deadline can't be more likely)",
  exclusive: "At most one outcome (sum ≤ 100%)",
  exclusive_exhaustive: "Exactly one outcome (sum = 100%)",
};

export default async function RelationsPage() {
  const data = await getRelations();
  const rels = (data?.relations ?? []).sort((a, b) => (b.latest_check?.gap_c ?? -1) - (a.latest_check?.gap_c ?? -1));
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Consistency</h1>
      <p className="mt-2 max-w-2xl text-[#8b95a1]">
        Groups of contracts whose prices must agree. Same-event ladders are verified automatically; other
        relationships stay &quot;suggested&quot; until someone checks the contract rules.
      </p>
      <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
        {rels.map((r) => (
          <li key={r.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              {r.latest_check ? <StatusPill status={r.latest_check.status} /> : <StatusPill status="insufficient_data" />}
              <code>{r.id}</code>
              <span className="text-neutral-500">{KIND_WORDS[r.kind] ?? r.kind}</span>
              {!r.verified && <span className="text-xs text-amber-600">suggested</span>}
              {r.source === "synthetic" && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Synthetic replay</span>
              )}
              <span className="ml-auto tabular-nums text-neutral-500">{r.members.length} contracts</span>
            </div>
            {r.latest_check && r.latest_check.status !== "coherent" && (
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">{r.latest_check.summary}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
