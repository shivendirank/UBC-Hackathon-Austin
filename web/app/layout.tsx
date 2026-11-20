import type { Metadata } from "next";
import { Suspense } from "react";
import { Syne } from "next/font/google";
import { AgentOrbHost } from "@/components/AgentOrbHost";
import { CopilotProviders } from "@/components/copilot/Providers";
import { OddsGlassField } from "@/components/OddsGlassField";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

/* Syne — geometric, high-character display face for the whole UI */
const sans = Syne({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Thin Ice",
  description: "Know what's behind the odds on Gemini prediction markets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className={`${sans.className} relative flex min-h-full flex-col bg-[#0a0c10] text-[#f2f4f6]`}>
        <div className="odds-field-root" aria-hidden>
          <OddsGlassField />
        </div>
        <div className="relative z-10 flex min-h-full flex-col">
          <CopilotProviders>
            <Suspense fallback={<header className="h-16 bg-[#0a0c10]" />}>
              <SiteHeader />
            </Suspense>
            {children}
            <Suspense fallback={null}>
              <AgentOrbHost />
            </Suspense>
          </CopilotProviders>
        </div>
      </body>
    </html>
  );
}
