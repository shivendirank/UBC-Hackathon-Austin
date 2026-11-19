"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ActiveMarket = {
  symbol: string | null;
  title: string | null;
  setActiveMarket: (symbol: string | null, title?: string | null) => void;
};

const Ctx = createContext<ActiveMarket | null>(null);

export function ActiveMarketProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const setActiveMarket = useCallback((s: string | null, t?: string | null) => {
    setSymbol(s);
    setTitle(t ?? null);
  }, []);

  const value = useMemo(() => ({ symbol, title, setActiveMarket }), [symbol, title, setActiveMarket]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveMarket() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActiveMarket requires ActiveMarketProvider");
  return v;
}
