import { connection } from "next/server";
import { NextResponse } from "next/server";
import { apiBase, apiFetchHeaders } from "@/lib/api-base";

/** Same-origin status so the orb does not need the Windows API tunnel for ElevenLabs. */
export async function GET() {
  await connection();
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim() ?? "";
  if (apiKey && agentId) {
    return NextResponse.json({
      elevenlabs_configured: true,
      agent_id_set: true,
      api_key_set: true,
    });
  }
  try {
    const upstream = await fetch(`${apiBase()}/api/copilot/status`, {
      headers: apiFetchHeaders(),
      cache: "no-store",
    });
    if (upstream.ok) {
      return NextResponse.json(await upstream.json());
    }
  } catch {
    /* backend down */
  }
  return NextResponse.json({
    elevenlabs_configured: false,
    agent_id_set: Boolean(agentId),
    api_key_set: Boolean(apiKey),
  });
}
