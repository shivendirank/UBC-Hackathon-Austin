import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thin Ice",
  description: "How much would it cost to move these odds? Live liquidity grades for Gemini prediction markets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex w-full max-w-5xl gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">Thin Ice</Link>
            <Link href="/" className="text-neutral-600 hover:underline dark:text-neutral-400">Markets</Link>
            <Link href="/relations" className="text-neutral-600 hover:underline dark:text-neutral-400">Consistency</Link>
            <Link href="/incidents" className="text-neutral-600 hover:underline dark:text-neutral-400">Incidents</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
