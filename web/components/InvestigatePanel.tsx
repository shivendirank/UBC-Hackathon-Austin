"use client";

import { useEffect, useRef, useState } from "react";
import { CONCLUSION_WORDS, StatusPill } from "@/components/StatusPill";
import { apiBase, type IncidentDetail } from "@/lib/api";

const POLL_MS = 4000;
const MAX_WAIT_MS = 3 * 60 * 1000;

type Props = {
  incidentId: number;
  initial: IncidentDetail;
};

type Phase = "idle" | "requesting" | "waiting" | "done" | "error";

export function InvestigatePanel({ incidentId, initial }: Props) {
  const [inc, setInc] = useState(initial);
  const [phase, setPhase] = useState<Phase>(initial.report ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "waiting") return;
    const id = window.setInterval(async () => {
      try {
        const r = await fetch(`${apiBase()}/api/incidents/${incidentId}`, { cache: "no-store" });
        if (!r.ok) return;
        const next = (await r.json()) as IncidentDetail;
        setInc(next);
        if (next.report) {
          setPhase("done");
          return;
        }
        if (startedAt.current && Date.now() - startedAt.current > MAX_WAIT_MS) {
          setError("Grok hasn’t filed a report yet. Check the Bot chat, or paste the prompt below.");
          setFallback(true);
          setPhase("error");
        }
      } catch {
        /* keep polling */
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [phase, incidentId]);

  async function investigate() {
    setError(null);
    setFallback(false);
    setPhase("requesting");
    try {
      const r = await fetch(`${apiBase()}/api/incidents/${incidentId}/investigate`, { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (r.status === 503) {
        setFallback(true);
        setError(typeof body.detail === "string" ? body.detail : "Grok webhook not configured.");
        setPhase("error");
        return;
      }
      if (!r.ok) {
        setError(typeof body.detail === "string" ? body.detail : `Request failed (${r.status}).`);
        setPhase("error");
        return;
      }
      startedAt.current = Date.now();
      setPhase("waiting");
    } catch {
      setError("Could not reach the Thin Ice API.");
      setPhase("error");
    }
  }

  if (inc.report || phase === "done") {
    const report = inc.report!;
    return (
      <div className="mt-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium">{CONCLUSION_WORDS[report.conclusion] ?? report.conclusion}</p>
        <p className="mt-2 text-sm">{report.summary}</p>
        {report.sources.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {report.sources.map((s) => (
              <li key={s}>
                <a className="text-sky-600 hover:underline" href={s}>
                  {s}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-neutral-500">Filed by {report.author}</p>
      </div>
    );
  }

  const prompt = `Recheck Thin Ice incident ${incidentId} with get_incident and recheck, then submit_report with sources.`;

  return (
    <div className="mt-2 rounded-lg surface-card p-4 text-sm text-[#c5ced6]">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-medium text-white">
          {phase === "waiting" ? "Grok Bot is investigating…" : "Investigation"}
        </p>
        {phase === "waiting" && <StatusPill status="open" />}
      </div>
      <p className="mt-2 text-[#8b95a1]">
        {phase === "waiting"
          ? "Waiting for submit_report. This page updates when the report lands."
          : "Start Grok Bot from here — it uses Thin Ice MCP tools and files the report on this incident."}
      </p>
      {(phase === "idle" || phase === "error") && (
        <button
          type="button"
          onClick={investigate}
          className="mt-4 rounded-md bg-[#9aebff] px-4 py-2 text-sm font-medium text-[#0b0d10] hover:bg-[#b5f1ff]"
        >
          Investigate with Grok
        </button>
      )}
      {phase === "requesting" && <p className="mt-4 text-[#9aebff]">Waking Grok Bot…</p>}
      {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
      {(fallback || phase === "error") && (
        <>
          <p className="mt-3 text-[#8b95a1]">Fallback — paste in Grok:</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-3 text-xs text-[#9aebff]">{prompt}</pre>
        </>
      )}
    </div>
  );
}
