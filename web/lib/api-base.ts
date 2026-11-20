/**
 * Resolve the Thin Ice API base URL.
 *
 * Production (Vercel): browser uses same-origin `/backend` (rewritten to the live API).
 * Server components prefer THIN_ICE_API_URL (direct) so SSR does not loop through the rewrite.
 * Local: defaults to http://localhost:8000.
 */
export function apiBase(): string {
  if (typeof window === "undefined") {
    const direct = process.env.THIN_ICE_API_URL?.trim().replace(/\/$/, "");
    if (direct) return direct;
  }

  const pub = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (pub) {
    if (pub.startsWith("http://") || pub.startsWith("https://")) return pub;
    const path = pub.startsWith("/") ? pub : `/${pub}`;
    if (typeof window !== "undefined") return path;
    const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    return `${host}${path}`;
  }

  return "http://localhost:8000";
}
