import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { apiFetchHeaders } from "@/lib/api-base";

const DROP = ["connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length", "host"];

/**
 * Same-origin proxy to the Thin Ice API.
 * Rewrites bake the tunnel host at build time and forward the browser User-Agent,
 * which makes ngrok return an HTML warning instead of JSON. This handler runs
 * per request and skips that warning.
 */
async function proxy(req: NextRequest, path: string[]) {
  await connection();
  const origin = (process.env.THIN_ICE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const target = `${origin}/${path.map((part) => encodeURIComponent(part)).join("/")}${req.nextUrl.search}`;
  const headers = apiFetchHeaders(req.headers);
  for (const name of DROP) headers.delete(name);
  headers.set("user-agent", "thin-ice-web");

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  });

  const out = new Headers(upstream.headers);
  for (const name of DROP) out.delete(name);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function HEAD(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
