import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit } from "next/font/google";
import { AgentOrbHost } from "@/components/AgentOrbHost";
import { CopilotProviders } from "@/components/copilot/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Thin Ice",
  description: "Know what's behind the odds on Gemini prediction markets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#07080a] text-[#f4f6f8]">
        <CopilotProviders>
          <Suspense fallback={<header className="h-16 border-b border-white/10 bg-[#07080a]" />}>
            <SiteHeader />
          </Suspense>
          {children}
          <Suspense fallback={null}>
            <AgentOrbHost />
          </Suspense>
        </CopilotProviders>
      </body>
    </html>
  );
}
