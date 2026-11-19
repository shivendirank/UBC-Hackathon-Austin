"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useActiveMarket } from "@/lib/active-market";

/** Keep active-market context aligned with /market/[symbol] routes. */
export function ActiveMarketSync() {
  const path = usePathname();
  const { symbol, setActiveMarket } = useActiveMarket();

  useEffect(() => {
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "market" && parts[1]) {
      const next = decodeURIComponent(parts[1]);
      if (next !== symbol) setActiveMarket(next, null);
      return;
    }
  }, [path, symbol, setActiveMarket]);

  return null;
}
