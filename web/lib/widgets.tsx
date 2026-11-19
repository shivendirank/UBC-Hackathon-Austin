"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CopilotAnalysis, CopilotRelated } from "@/lib/copilot-api";

export type WidgetKind =
  | "market_overview"
  | "liquidity_evidence"
  | "market_comparison"
  | "probability_history"
  | "investigation";

export type WidgetPanel = {
  id: string;
  kind: WidgetKind;
  title: string;
  marketIds: string[];
  minimized: boolean;
  highlight?: string | null;
  analysis?: CopilotAnalysis | null;
  related?: CopilotRelated | null;
  compare?: CopilotAnalysis[] | null;
  error?: string | null;
  loading?: boolean;
};

export type WidgetStore = {
  panels: WidgetPanel[];
  openOrUpdate: (panel: Omit<WidgetPanel, "minimized"> & { minimized?: boolean }) => void;
  minimize: (id?: string) => void;
  restore: (id: string) => void;
  close: (id?: string) => void;
  highlight: (metricId: string, panelId?: string) => void;
};

const Ctx = createContext<WidgetStore | null>(null);

function kindKey(kind: WidgetKind, marketIds: string[]) {
  return `${kind}:${[...marketIds].sort().join(",")}`;
}

export function WidgetProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<WidgetPanel[]>([]);

  const openOrUpdate = useCallback((panel: Omit<WidgetPanel, "minimized"> & { minimized?: boolean }) => {
    const id = panel.id || kindKey(panel.kind, panel.marketIds);
    setPanels((prev) => {
      const i = prev.findIndex((p) => p.id === id || (p.kind === panel.kind && kindKey(p.kind, p.marketIds) === id));
      const next: WidgetPanel = { minimized: false, ...panel, id };
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], ...next, minimized: false };
        return copy;
      }
      return [...prev, next].slice(-4);
    });
  }, []);

  const minimize = useCallback((id?: string) => {
    setPanels((prev) => {
      if (!prev.length) return prev;
      const target = id ?? prev[prev.length - 1]?.id;
      return prev.map((p) => (p.id === target ? { ...p, minimized: true } : p));
    });
  }, []);

  const restore = useCallback((id: string) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, minimized: false } : p)));
  }, []);

  const close = useCallback((id?: string) => {
    setPanels((prev) => {
      if (!id) return prev.slice(0, -1);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const highlight = useCallback((metricId: string, panelId?: string) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (panelId && p.id !== panelId) return p;
        if (!panelId && p !== prev[prev.length - 1]) return p;
        return { ...p, highlight: metricId };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ panels, openOrUpdate, minimize, restore, close, highlight }),
    [panels, openOrUpdate, minimize, restore, close, highlight],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWidgets() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWidgets requires WidgetProvider");
  return v;
}
