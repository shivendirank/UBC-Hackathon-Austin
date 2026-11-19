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
          {[
            { label: "YES mid", value: a.odds_pct != null ? `${a.odds_pct.toFixed(0)}%` : "—" },
            { label: "Move 10¢", value: usd(a.move_cost_usd) },
            { label: "Book", value: a.grade_words },
            { label: "Spread", value: a.spread_c != null ? `${a.spread_c.toFixed(1)}¢` : "—" },
          ].map((cell) => (
            <div
              key={cell.label}
              className="rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2.5 shadow-sm ring-1 ring-inset ring-white/5 backdrop-blur-md"
            >
              <p className="text-[11px] text-[#8b95a1]">{cell.label}</p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-white">{cell.value}</p>
            </div>
          ))}
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
      <ul className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] ring-1 ring-inset ring-white/5 backdrop-blur-md">
        {rows.map((r, idx) => (
          <li key={r.symbol} className={idx > 0 ? "border-t border-white/10" : undefined}>
            <Link
              href={`/market/${encodeURIComponent(r.symbol)}`}
              className="flex items-start justify-between gap-3 px-3.5 py-2.5 transition hover:bg-white/[0.06]"
            >
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13px] font-medium text-white">{r.title}</p>
                <p className="text-[11px] text-[#8b95a1]">{r.grade}</p>
              </div>
              <span className="tabular-nums text-[#9aebff]">{r.odds_pct != null ? `${r.odds_pct.toFixed(0)}%` : "—"}</span>
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
            className="pointer-events-auto rounded-full border border-white/20 bg-[rgba(12,16,22,0.5)] px-3.5 py-2 text-xs text-[#c5ced6] shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/10"
          >
            {p.title}
          </button>
        ) : (
          <section
            key={p.id}
            className="pointer-events-auto w-full overflow-hidden rounded-[22px] border border-white/20 bg-[rgba(12,16,22,0.55)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/10 backdrop-blur-2xl"
          >
            <header className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3.5 py-2.5">
              <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-white">
                {p.title}
              </h3>
              <button
                type="button"
                className="rounded-lg px-2 py-0.5 text-[#8b95a1] transition hover:bg-white/10 hover:text-white"
                onClick={() => minimize(p.id)}
              >
                —
              </button>
              <button
                type="button"
                className="rounded-lg px-2 py-0.5 text-[#8b95a1] transition hover:bg-white/10 hover:text-white"
                onClick={() => close(p.id)}
              >
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
