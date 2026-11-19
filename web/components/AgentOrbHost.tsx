"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CompareAgent } from "@/components/CompareAgent";

/** Jag's Strands orb on every main page, with route-aware market context. */
export function AgentOrbHost() {
  const path = usePathname();
  const sp = useSearchParams();

  const symbols = useMemo(() => {
    if (path.startsWith("/market/")) {
      const raw = decodeURIComponent(path.slice("/market/".length).split("/")[0] ?? "");
      return raw ? [raw] : [];
    }
    if (path.startsWith("/compare")) {
      const a = sp.get("a");
      const b = sp.get("b");
      const symbol = sp.get("symbol");
      if (a && b) return [a, b];
      if (symbol) return [symbol];
    }
    return [];
  }, [path, sp]);

  if (path === "/login") return null;
  return <CompareAgent symbols={symbols} />;
}
