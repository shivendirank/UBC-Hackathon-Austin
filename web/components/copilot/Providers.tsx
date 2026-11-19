"use client";

import type { ReactNode } from "react";
import { ConversationProvider } from "@elevenlabs/react";
import { ActiveMarketProvider } from "@/lib/active-market";
import { WidgetProvider } from "@/lib/widgets";
import { ActiveMarketSync } from "@/components/copilot/ActiveMarketSync";

export function CopilotProviders({ children }: { children: ReactNode }) {
  return (
    <ActiveMarketProvider>
      <WidgetProvider>
        <ConversationProvider>
          <ActiveMarketSync />
          {children}
        </ConversationProvider>
      </WidgetProvider>
    </ActiveMarketProvider>
  );
}
