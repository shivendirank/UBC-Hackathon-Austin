"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sticker } from "@/components/Stickers";
import { clearSession, readUser, type SessionUser } from "@/lib/session";

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
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(readUser());
  }, [path]);

  if (path === "/login") {
    return (
      <header className="glass-header sticky top-0 z-30">
        <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <Sticker category={null} className="h-6 w-6" />
            <span className="text-[15px] font-semibold tracking-[-0.04em] text-white">Thin Ice</span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="glass-header sticky top-0 z-30">
      <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center gap-6 px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <Sticker category={null} className="h-6 w-6" />
          <span className="text-[15px] font-semibold tracking-[-0.04em] text-white">Thin Ice</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-5 overflow-x-auto" aria-label="Primary">
          {LINKS.map((link) => {
            const on = active(path, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 text-[13px] font-medium tracking-[-0.01em] ${on ? "text-white" : "text-[#8b95a1] hover:text-white"}`}
                aria-current={on ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <form action="/" className="ml-auto w-32 shrink-0 sm:w-52">
          <input
            name="q"
            placeholder="Search predictions"
            aria-label="Search predictions"
            className="h-9 w-full rounded-full surface-card px-4 text-sm text-white outline-none placeholder:text-[#6f7882]"
          />
        </form>
        {user ? (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-[#9aa3ad] sm:inline">{user.name || user.email}</span>
            <button
              type="button"
              onClick={() => {
                clearSession();
                setUser(null);
              }}
              className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#8b95a1] hover:text-white"
            >
              Log out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="shrink-0 text-[12px] font-medium uppercase tracking-[0.16em] text-white"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
