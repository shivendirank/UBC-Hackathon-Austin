"use client";

import { fetchAnalysis, fetchCompare, fetchRelated, resolveMarket } from "@/lib/copilot-api";
import type { WidgetStore } from "@/lib/widgets";

export type CopilotToolDeps = {
  widgets: WidgetStore;
  resolveSymbol: () => string | null;
  navigate: (path: string) => void;
  setActiveMarket: (symbol: string, title?: string | null) => void;
};

async function resolveId(
  deps: CopilotToolDeps,
  parameters: { market_id?: string; query?: string },
): Promise<{ symbol: string | null; note?: string; fromQuery: boolean }> {
  if (parameters.market_id?.trim()) {
    return { symbol: parameters.market_id.trim(), fromQuery: false };
  }
  if (parameters.query?.trim()) {
    try {
      const hit = await resolveMarket(parameters.query.trim());
      return {
        symbol: hit.symbol,
        note: `${hit.event_title ?? hit.symbol} (${hit.label ?? "contract"})`,
        fromQuery: true,
      };
    } catch {
      return {
        symbol: null,
        note: `No Thin Ice market matched “${parameters.query.trim()}”.`,
        fromQuery: true,
      };
    }
  }
  return { symbol: deps.resolveSymbol(), fromQuery: false };
}

function ensureOnMarket(deps: CopilotToolDeps, symbol: string, title?: string | null) {
  deps.setActiveMarket(symbol, title ?? null);
  const target = `/market/${encodeURIComponent(symbol)}`;
  if (typeof window === "undefined") {
    deps.navigate(target);
    return true;
  }
  const parts = window.location.pathname.split("/").filter(Boolean);
  const current = parts[0] === "market" && parts[1] ? decodeURIComponent(parts[1]) : null;
  if (current !== symbol) {
    deps.navigate(target);
    return true;
  }
  return false;
}

export function buildClientTools(deps: CopilotToolDeps) {
  const { widgets } = deps;

  return {
    async resolve_market(parameters: { query?: string; market_id?: string }) {
      const { symbol, note } = await resolveId(deps, parameters);
      if (!symbol) return note || "Tell me a market name, Gemini URL, or open a market page first.";
      try {
        const hit = parameters.query?.trim()
          ? await resolveMarket(parameters.query.trim())
          : await resolveMarket(symbol);
        const navigated = ensureOnMarket(deps, hit.symbol, hit.event_title);
        return JSON.stringify({
          symbol: hit.symbol,
          path: hit.path,
          event_title: hit.event_title,
          label: hit.label,
          odds_pct: hit.odds_pct,
          grade_words: hit.grade_words,
          move_cost_usd: hit.move_cost_usd,
          navigated,
        });
      } catch (e) {
        return e instanceof Error ? e.message : "Resolve failed";
      }
    },

    async open_market_page(parameters: { market_id?: string; query?: string }) {
      const { symbol, note } = await resolveId(deps, parameters);
      if (!symbol) return note || "Which market should I open?";
      let title: string | null = null;
      let analysis = null as Awaited<ReturnType<typeof fetchAnalysis>> | null;
      try {
        analysis = await fetchAnalysis(symbol);
        title = analysis.event_title;
      } catch {
        /* still navigate */
      }
      ensureOnMarket(deps, symbol, title);
      widgets.openOrUpdate({
        id: `market_overview:${symbol}`,
        kind: "market_overview",
        title: title || `Market · ${symbol}`,
        marketIds: [symbol],
        loading: !analysis,
        analysis,
        error: null,
      });
      if (!analysis) {
        try {
          analysis = await fetchAnalysis(symbol);
          widgets.openOrUpdate({
            id: `market_overview:${symbol}`,
            kind: "market_overview",
            title: analysis.event_title || symbol,
            marketIds: [symbol],
            analysis,
            loading: false,
            error: null,
          });
        } catch (e) {
          widgets.openOrUpdate({
            id: `market_overview:${symbol}`,
            kind: "market_overview",
            title: symbol,
            marketIds: [symbol],
            loading: false,
            error: e instanceof Error ? e.message : "failed",
          });
        }
      }
      return `Opened Thin Ice page /market/${symbol}${title ? ` — ${title}` : ""}.`;
    },

    async get_market_analysis(parameters: { market_id?: string; query?: string }) {
      const { symbol, note, fromQuery } = await resolveId(deps, parameters);
      if (!symbol) return note || "Which market should I analyze?";
      try {
        const a = await fetchAnalysis(symbol);
        if (fromQuery || parameters.market_id) ensureOnMarket(deps, symbol, a.event_title);
        return JSON.stringify({
          symbol: a.symbol,
          event_title: a.event_title,
          label: a.label,
          odds_pct: a.odds_pct,
          grade_words: a.grade_words,
          move_cost_usd: a.move_cost_usd,
          spread_c: a.spread_c,
          liquidity_summary: a.liquidity_summary,
          reasons: a.reasons,
          synthetic: a.synthetic,
          path: `/market/${a.symbol}`,
        });
      } catch (e) {
        return e instanceof Error ? e.message : "Analysis failed";
      }
    },

    async open_market_widget(parameters: { market_id?: string; query?: string }) {
      const { symbol, note, fromQuery } = await resolveId(deps, parameters);
      if (!symbol) return note || "Which market? Name one, or open a market page first.";
      if (fromQuery || parameters.market_id) ensureOnMarket(deps, symbol);
      widgets.openOrUpdate({
        id: `market_overview:${symbol}`,
        kind: "market_overview",
        title: `Market · ${symbol}`,
        marketIds: [symbol],
        loading: true,
      });
      try {
        const analysis = await fetchAnalysis(symbol);
        ensureOnMarket(deps, symbol, analysis.event_title);
        widgets.openOrUpdate({
          id: `market_overview:${symbol}`,
          kind: "market_overview",
          title: analysis.event_title || symbol,
          marketIds: [symbol],
          analysis,
          loading: false,
          error: null,
        });
        return `Opened overview for ${symbol}. Odds ${analysis.odds_pct ?? "—"}%, ${analysis.grade_words}.`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        widgets.openOrUpdate({
          id: `market_overview:${symbol}`,
          kind: "market_overview",
          title: symbol,
          marketIds: [symbol],
          loading: false,
          error: msg,
        });
        return `Could not load ${symbol}: ${msg}`;
      }
    },

    async show_liquidity_chart(parameters: { market_id?: string; query?: string }) {
      const { symbol, note, fromQuery } = await resolveId(deps, parameters);
      if (!symbol) return note || "Which market should I show liquidity for?";
      if (fromQuery || parameters.market_id) ensureOnMarket(deps, symbol);
      widgets.openOrUpdate({
        id: `liquidity_evidence:${symbol}`,
        kind: "liquidity_evidence",
        title: `Liquidity · ${symbol}`,
        marketIds: [symbol],
        loading: true,
      });
      try {
        const analysis = await fetchAnalysis(symbol);
        ensureOnMarket(deps, symbol, analysis.event_title);
        widgets.openOrUpdate({
          id: `liquidity_evidence:${symbol}`,
          kind: "liquidity_evidence",
          title: `Liquidity · ${analysis.label || symbol}`,
          marketIds: [symbol],
          analysis,
          loading: false,
          error: null,
        });
        return analysis.liquidity_summary || `Move cost about $${analysis.move_cost_usd}.`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        widgets.openOrUpdate({
          id: `liquidity_evidence:${symbol}`,
          kind: "liquidity_evidence",
          title: symbol,
          marketIds: [symbol],
          loading: false,
          error: msg,
        });
        return `Liquidity load failed: ${msg}`;
      }
    },

    async show_probability_history(parameters: { market_id?: string; query?: string }) {
      const { symbol, note, fromQuery } = await resolveId(deps, parameters);
      if (!symbol) return note || "Which market history should I open?";
      if (fromQuery || parameters.market_id) ensureOnMarket(deps, symbol);
      widgets.openOrUpdate({
        id: `probability_history:${symbol}`,
        kind: "probability_history",
        title: `History · ${symbol}`,
        marketIds: [symbol],
        loading: true,
      });
      try {
        const analysis = await fetchAnalysis(symbol);
        ensureOnMarket(deps, symbol, analysis.event_title);
        widgets.openOrUpdate({
          id: `probability_history:${symbol}`,
          kind: "probability_history",
          title: `History · ${analysis.label || symbol}`,
          marketIds: [symbol],
          analysis,
          loading: false,
          error: null,
        });
        return `Opened probability history (${analysis.history.length} points).`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        widgets.openOrUpdate({
          id: `probability_history:${symbol}`,
          kind: "probability_history",
          title: symbol,
          marketIds: [symbol],
          loading: false,
          error: msg,
        });
        return `History load failed: ${msg}`;
      }
    },

    async open_comparison_widget(parameters: {
      market_ids?: string[] | string;
      market_id?: string;
      query?: string;
    }) {
      const rawIds = parameters.market_ids;
      let ids = Array.isArray(rawIds)
        ? rawIds.filter(Boolean)
        : typeof rawIds === "string"
          ? rawIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
          : [];
      const seedHit = await resolveId(deps, parameters);
      const seed = seedHit.symbol;
      if (seed && (seedHit.fromQuery || parameters.market_id)) ensureOnMarket(deps, seed);
      let related: Awaited<ReturnType<typeof fetchRelated>> | null = null;
      if (!ids.length && seed) {
        related = await fetchRelated(seed);
        const fromRel = related.relations[0]?.members.map((m) => m.symbol) ?? [seed];
        ids = fromRel.slice(0, 6);
      }
      if (!ids.length) return "Name markets to compare, or open one market first.";
      try {
        if (!related && ids[0]) {
          try {
            related = await fetchRelated(ids[0]);
          } catch {
            related = null;
          }
        }
        const cmp = await fetchCompare(ids);
        const heading =
          related?.relations[0]?.note?.trim() ||
          cmp.markets.find((m) => m.event_title)?.event_title?.trim() ||
          "Market comparison";
        widgets.openOrUpdate({
          id: `market_comparison:${ids.join(",")}`,
          kind: "market_comparison",
          title: heading,
          marketIds: ids,
          related,
          compare: cmp.markets,
          loading: false,
          error: null,
        });
        return `Compared ${cmp.markets.length} markets from Thin Ice data.`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        widgets.openOrUpdate({
          id: `market_comparison:${ids.join(",")}`,
          kind: "market_comparison",
          title: "Market comparison",
          marketIds: ids,
          related,
          loading: false,
          error: msg,
        });
        return `Compare failed: ${msg}`;
      }
    },

    async find_related_markets(parameters: { market_id?: string; query?: string }) {
      const { symbol, note, fromQuery } = await resolveId(deps, parameters);
      if (!symbol) return note || "Which market’s relations should I load?";
      if (fromQuery || parameters.market_id) ensureOnMarket(deps, symbol);
      try {
        return JSON.stringify(await fetchRelated(symbol));
      } catch (e) {
        return e instanceof Error ? e.message : "Related lookup failed";
      }
    },

    async highlight_metric(parameters: { metric_id: string }) {
      if (!parameters.metric_id) return "metric_id required";
      widgets.highlight(parameters.metric_id);
      return `Highlighted ${parameters.metric_id}`;
    },

    async open_investigation(parameters: { incident_id?: string | number }) {
      const id = parameters.incident_id;
      if (id == null || id === "") return "incident_id required";
      deps.navigate(`/incidents/${encodeURIComponent(String(id))}`);
      widgets.openOrUpdate({
        id: `investigation:${id}`,
        kind: "investigation",
        title: `Incident ${id}`,
        marketIds: [],
        loading: false,
        error: null,
      });
      return `Opened /incidents/${id}.`;
    },

    async minimize_widget() {
      widgets.minimize();
      return "Minimized the front widget.";
    },

    async close_widget() {
      widgets.close();
      return "Closed the front widget.";
    },
  };
}

export type ClientTools = ReturnType<typeof buildClientTools>;
