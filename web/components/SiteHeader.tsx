"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sticker } from "@/components/Stickers";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/compare", label: "Compare" },
  { href: "/incidents", label: "Incidents" },
  { href: "/watch", label: "Watch" },
];

function active(path: string, href: string): boolean {
  if (href === "/") return path === "/" || path.startsWith("/market");
  return path === href || path.startsWith(`${href}/`);
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080a]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center gap-6 px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <Sticker category={null} className="h-8 w-8" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-white">Thin Ice</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-5 overflow-x-auto" aria-label="Primary">
          {LINKS.map((link) => {
            const on = active(path, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 text-[12px] font-medium uppercase tracking-[0.16em] ${on ? "text-white" : "text-[#8b95a1] hover:text-white"}`}
                aria-current={on ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <form action="/" className="ml-auto w-40 shrink-0 sm:w-64">
          <input
            name="q"
            placeholder="Search predictions"
            aria-label="Search predictions"
            className="h-9 w-full rounded-full border border-white/10 bg-[#12141a] px-4 text-sm text-white outline-none placeholder:text-[#6f7882]"
          />
        </form>
      </div>
    </header>
  );
}
