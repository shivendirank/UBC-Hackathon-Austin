import Link from "next/link";
import { notFound } from "next/navigation";
import { InvestigatePanel } from "@/components/InvestigatePanel";
import { StatusPill } from "@/components/StatusPill";
import { getIncident } from "@/lib/api";

export default async function IncidentPage(props: PageProps<"/incidents/[id]">) {
  const { id } = await props.params;
  const inc = await getIncident(id);
  if (!inc) notFound();
  const check = inc.latest_check;
  const labels = Object.fromEntries(inc.contracts.map((c) => [c.symbol, c.label]));
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/incidents" className="text-sm text-sky-600 hover:underline">← All incidents</Link>
      <h1 className="mt-6 text-2xl font-bold">
        {inc.kind === "inconsistency" ? "Related prices disagree" : "Unusual move on a thin book"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Incident #{inc.id} · <code>{inc.subject}</code> · opened {new Date(inc.opened_at * 1000).toLocaleString()}
      </p>
      <div className="mt-4"><StatusPill status={inc.status} /></div>
      {(inc.synthetic || inc.subject.startsWith("synthetic:")) && (
        <p className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          Synthetic replay. The books behind this incident were written for the demo, not read from Gemini.
        </p>
      )}

      {check && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What the math says</h2>
          <div className="mt-2 flex items-center gap-2"><StatusPill status={check.status} /></div>
          <p className="mt-2 text-neutral-700 dark:text-neutral-300">{check.summary}</p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <tr><th className="py-1 pr-2">Contract</th><th className="py-1 pr-2">Quoted</th><th className="py-1">Nearest consistent</th></tr>
            </thead>
            <tbody>
              {Object.entries(check.prices_c).map(([sym, p]) => (
                <tr key={sym} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-1 pr-2">{labels[sym] ?? sym}</td>
                  <td className="py-1 pr-2 tabular-nums">{p != null ? `${p.toFixed(1)}%` : "one-sided"}</td>
                  <td className="py-1 tabular-nums">{check.coherent_c[sym] != null ? `${check.coherent_c[sym].toFixed(1)}%` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">
            Total adjustment to make these consistent: {check.gap_c.toFixed(1)} points. Books recorded within{" "}
            {check.max_skew_s}s of each other.
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Investigation</h2>
        <InvestigatePanel incidentId={inc.id} initial={inc} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Contract rules</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {inc.contracts.map((c) => (
            <li key={c.symbol}>
              {c.label} · expires {c.expiry ? new Date(c.expiry).toLocaleString() : "?"}
              {c.terms_url && <> · <a className="text-sky-600 hover:underline" href={c.terms_url}>terms</a></>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {inc.timeline.map((t, i) => (
            <li key={i}>
              <span className="tabular-nums text-neutral-500">{new Date(t.ts * 1000).toLocaleTimeString()}</span>{" "}
              {t.event.replaceAll("_", " ")}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
