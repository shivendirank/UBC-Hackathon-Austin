import Link from "next/link";
import { CONCLUSION_WORDS, StatusPill } from "@/components/StatusPill";
import { getIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  const data = await getIncidents();
  const incidents = data?.incidents ?? [];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Incidents</h1>
      <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
        Cases the deterministic engines flagged: related contracts whose prices contradict each other, and
        unusual moves on thin books. Grok Bot investigates each one and files a sourced report.
      </p>
      {incidents.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No incidents yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {incidents.map((i) => (
            <li key={i.id} className="py-3">
              <Link href={`/incidents/${i.id}`} className="flex flex-wrap items-center gap-3 hover:underline">
                <StatusPill status={i.status} />
                <span className="font-medium">
                  {i.kind === "inconsistency" ? "Related prices disagree" : "Unusual move on a thin book"}
                </span>
                <code className="text-xs text-neutral-500">{i.subject}</code>
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
