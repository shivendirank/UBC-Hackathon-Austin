import { connection } from "next/server";
import { NextResponse } from "next/server";
import { apiBase, apiFetchHeaders } from "@/lib/api-base";

/**
 * Mint an ElevenLabs signed URL on Vercel (server-only env).
 * Avoids the Windows backend WinError 10013 path when calling api.elevenlabs.io.
 * Locally, falls back to the FastAPI backend if web env keys are unset.
 */
export async function POST(req: Request) {
  await connection();
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim() ?? "";

  let body: { symbol?: string | null; path?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }
  const context = { symbol: body.symbol ?? null, path: body.path ?? null };

  if (!apiKey || !agentId) {
    try {
      const upstream = await fetch(`${apiBase()}/api/copilot/session`, {
        method: "POST",
        headers: apiFetchHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json({
        configured: false,
        reason:
          "Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in Vercel env (Project → Settings → Environment Variables), then redeploy.",
        context,
      });
    }
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`;
  try {
    const response = await fetch(url, {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as { signed_url?: string };
      return NextResponse.json({
        configured: true,
        agent_id: agentId,
        conversation_token: null,
        signed_url: data.signed_url ?? null,
        context,
      });
    }
    const detail = (await response.text()).slice(0, 300);
    return NextResponse.json({
      configured: true,
      agent_id: agentId,
      conversation_token: null,
      signed_url: null,
      error: `ElevenLabs signed-url HTTP ${response.status}: ${detail}`,
      context,
    });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      agent_id: agentId,
      conversation_token: null,
      signed_url: null,
      error: `ElevenLabs request failed: ${e instanceof Error ? e.message : String(e)}`,
      context,
    });
  }
}
