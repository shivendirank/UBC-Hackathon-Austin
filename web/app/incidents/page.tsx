import Link from "next/link";
import { CONCLUSION_WORDS, StatusPill } from "@/components/StatusPill";
import { getIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  const data = await getIncidents();
  const incidents = data?.incidents ?? [];
  return (
    <main className="mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Incidents</h1>
      <p className="mt-2 max-w-2xl text-[#8b95a1]">
        Cases the deterministic engines flagged: related contracts whose prices contradict each other, and
        unusual moves on thin books. Grok Bot investigates each one and files a sourced report.
      </p>
      {incidents.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No incidents yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[#2a2e36] rounded-2xl border border-[#2a2e36] bg-[#14171c] px-4">
          {incidents.map((i) => (
            <li key={i.id} className="py-3">
              <Link href={`/incidents/${i.id}`} className="flex flex-wrap items-center gap-3 hover:underline">
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-[#9aebff]">
                  #{i.id}
                </span>
                <StatusPill status={i.status} />
                <span className="font-medium">
                  {i.kind === "inconsistency" ? "Related prices disagree" : "Unusual move on a thin book"}
                </span>
                <code className="text-xs text-neutral-500">{i.subject}</code>
                {i.report ? (
                  <span className="text-xs text-[#8ee0b0]">Grok reported</span>
                ) : (
                  <span className="text-xs text-[#ffc46b]">Awaiting Grok</span>
                )}
                {i.conclusion && <span className="text-sm">· {CONCLUSION_WORDS[i.conclusion] ?? i.conclusion}</span>}
                <span className="ml-auto text-xs text-neutral-500">{new Date(i.updated_at * 1000).toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
