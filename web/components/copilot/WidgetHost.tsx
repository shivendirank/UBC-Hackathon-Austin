"use client";

import Link from "next/link";
import { useWidgets, type WidgetPanel } from "@/lib/widgets";
import { usd } from "@/lib/format";

function marketTitle(eventTitle: string | null | undefined, label: string | null | undefined, symbol: string) {
  return eventTitle?.trim() || label?.trim() || symbol;
}

function Body({ panel }: { panel: WidgetPanel }) {
  if (panel.loading) return <p className="py-4 text-[#8b95a1]">Loading Thin Ice data…</p>;
  if (panel.error) return <p className="text-[#ff8b98]">{panel.error}</p>;

  if (panel.kind === "market_overview" && panel.analysis) {
    const a = panel.analysis;
    return (
      <>
        <p className="text-xs text-[#8b95a1]">{a.category ?? "Market"}</p>
        <p className="font-medium text-white">{a.event_title || a.label || a.symbol}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[#8b95a1]">YES mid</p>
            <p className="text-lg font-semibold text-white">{a.odds_pct != null ? `${a.odds_pct.toFixed(0)}%` : "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[#8b95a1]">Move 10¢</p>
            <p className="text-lg font-semibold text-white">{usd(a.move_cost_usd)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[#8b95a1]">Book</p>
            <p className="font-semibold text-white">{a.grade_words}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[#8b95a1]">Spread</p>
            <p className="font-semibold text-white">{a.spread_c != null ? `${a.spread_c.toFixed(1)}¢` : "—"}</p>
          </div>
        </div>
        {a.liquidity_summary && <p className="mt-3 text-xs leading-relaxed text-[#9aa3ad]">{a.liquidity_summary}</p>}
      </>
    );
  }

  if (panel.kind === "liquidity_evidence" && panel.analysis) {
    const a = panel.analysis;
    return (
      <>
        <p className="text-sm text-[#d7dde4]">{a.liquidity_summary || "No liquidity summary."}</p>
        <p className="mt-2 text-sm text-white">Move cost {usd(a.move_cost_usd)} · grade {a.grade}</p>
      </>
    );
  }

  if (panel.kind === "probability_history" && panel.analysis) {
    const pts = panel.analysis.history.slice(-8);
    return (
      <ul className="space-y-1 text-xs text-[#c5ced6]">
        {pts.map((p) => (
          <li key={p.ts} className="flex justify-between gap-3">
            <span>{new Date(p.ts * 1000).toLocaleString()}</span>
            <span className="tabular-nums text-white">{p.odds_pct != null ? `${p.odds_pct.toFixed(0)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (panel.kind === "market_comparison") {
    const rows =
      panel.compare?.map((m) => ({
        symbol: m.symbol,
        title: marketTitle(m.event_title, m.label, m.symbol),
        odds_pct: m.odds_pct,
        grade: m.grade_words || m.grade,
      })) ??
      panel.related?.relations[0]?.members.map((m) => ({
        symbol: m.symbol,
        title: marketTitle(m.event_title, m.label, m.symbol),
        odds_pct: m.odds_pct,
        grade: m.grade,
      }));
    if (!rows?.length) return <p className="text-[#8b95a1]">No related contracts found.</p>;
    return (
      <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
        {rows.map((r) => (
          <li key={r.symbol}>
            <Link href={`/market/${encodeURIComponent(r.symbol)}`} className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13px] font-medium text-white">{r.title}</p>
                <p className="text-[11px] text-[#8b95a1]">{r.grade}</p>
              </div>
              <span className="tabular-nums text-white">{r.odds_pct != null ? `${r.odds_pct.toFixed(0)}%` : "—"}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (panel.kind === "investigation") {
    return <p className="text-[#9aa3ad]">Open the Incidents page for the full timeline and report.</p>;
  }

  return <p className="text-[#8b95a1]">No data.</p>;
}

export function WidgetHost() {
  const { panels, minimize, close, restore } = useWidgets();
  if (!panels.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-28 left-4 z-40 flex max-w-[min(100vw-2rem,360px)] flex-col items-start gap-3 sm:bottom-32 sm:left-6">
      {panels.map((p) =>
        p.minimized ? (
          <button
            key={p.id}
            type="button"
            onClick={() => restore(p.id)}
            className="pointer-events-auto rounded-full border border-white/15 bg-[#0c0e12]/95 px-3.5 py-2 text-xs text-[#c5ced6]"
          >
            {p.title}
          </button>
        ) : (
          <section
            key={p.id}
            className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0c0e12]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
          >
            <header className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
              <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9aebff]">
                {p.title}
              </h3>
              <button type="button" className="px-1 text-[#8b95a1] hover:text-white" onClick={() => minimize(p.id)}>
                —
              </button>
              <button type="button" className="px-1 text-[#8b95a1] hover:text-white" onClick={() => close(p.id)}>
                ×
              </button>
            </header>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3.5 text-sm text-[#d7dde4]">
              <Body panel={p} />
            </div>
          </section>
        ),
      )}
    </div>
  );
}
