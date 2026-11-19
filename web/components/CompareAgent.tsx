"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversationControls, useConversationStatus } from "@elevenlabs/react";
import Strands from "@/components/react-bits/Strands";
import { WidgetHost } from "@/components/copilot/WidgetHost";
import { useActiveMarket } from "@/lib/active-market";
import { createCopilotSession, fetchCopilotStatus } from "@/lib/copilot-api";
import { buildClientTools } from "@/lib/copilot-tools";
import { useWidgets } from "@/lib/widgets";

type Msg = { role: "user" | "agent" | "system"; text: string };

/**
 * Jag's Strands orb + Thin Ice ElevenLabs session/tools/widgets.
 */
export function CompareAgent({ symbols = [] }: { symbols?: string[] }) {
  const router = useRouter();
  const { symbol, title, setActiveMarket } = useActiveMarket();
  const widgets = useWidgets();
  const { startSession, endSession, sendUserMessage } = useConversationControls();
  const { status } = useConversationStatus();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      text: "Activate voice for ElevenLabs, or ask in text. I use Thin Ice tools for real grades — I don’t invent odds.",
    },
  ]);
  const sessionBusy = useRef(false);

  const tools = useMemo(
    () =>
      buildClientTools({
        widgets,
        resolveSymbol: () => symbol ?? symbols[0] ?? null,
        navigate: (path) => router.push(path),
        setActiveMarket: (s, t) => setActiveMarket(s, t),
      }),
    [widgets, symbol, symbols, router, setActiveMarket],
  );

  useEffect(() => {
    if (symbols[0] && !symbol) setActiveMarket(symbols[0], null);
  }, [symbols, symbol, setActiveMarket]);

  useEffect(() => {
    void fetchCopilotStatus()
      .then((s) => setVoiceConfigured(s.elevenlabs_configured))
      .catch(() => setVoiceConfigured(false));
  }, []);

  useEffect(() => {
    if (status === "connected") {
      setLevel(0.7);
      setMessages((m) =>
        m.some((x) => x.text.includes("Voice connected"))
          ? m
          : [...m, { role: "system", text: "Voice connected. Speak, or type below." }],
      );
    } else {
      setLevel(undefined);
    }
  }, [status]);

  const connected = status === "connected";
  const listening = connected || busy;

  const activate = useCallback(async () => {
    if (sessionBusy.current) return;
    sessionBusy.current = true;
    setBusy(true);
    setOpen(true);
    setMessages((m) => [...m, { role: "system", text: "Starting ElevenLabs session…" }]);
    try {
      const sess = await createCopilotSession({
        symbol: symbol ?? symbols[0] ?? null,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      if (!sess.configured || (!sess.signed_url && !sess.agent_id)) {
        setVoiceConfigured(false);
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text:
              sess.reason ||
              sess.error ||
              "ElevenLabs is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in backend/.env.",
          },
        ]);
        return;
      }
      setVoiceConfigured(true);
      const opts: {
        signedUrl?: string;
        agentId?: string;
        clientTools: typeof tools;
        dynamicVariables?: Record<string, string>;
      } = {
        clientTools: tools,
        dynamicVariables: {
          market_symbol: symbol ?? symbols[0] ?? "",
          market_title: title ?? "",
          app_path: typeof window !== "undefined" ? window.location.pathname : "",
        },
      };
      if (sess.signed_url) opts.signedUrl = sess.signed_url;
      else if (sess.agent_id) opts.agentId = sess.agent_id;
      await startSession(opts as Parameters<typeof startSession>[0]);
      setMessages((m) => [...m, { role: "agent", text: "Listening. Ask about a market, liquidity, or compare." }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "agent", text: e instanceof Error ? e.message : "Could not start voice session" },
      ]);
    } finally {
      setBusy(false);
      sessionBusy.current = false;
    }
  }, [symbol, symbols, title, tools, startSession]);

  const endVoice = useCallback(async () => {
    sessionBusy.current = false;
    try {
      await endSession();
    } catch {
      /* none */
    }
    setMessages((m) => [...m, { role: "system", text: "Voice ended." }]);
  }, [endSession]);

  const askText = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      if (connected && sendUserMessage) {
        await sendUserMessage(q);
        setMessages((m) => [...m, { role: "system", text: "Sent to ElevenLabs…" }]);
      } else {
        // Offline / no voice: run Thin Ice tools directly
        const lower = q.toLowerCase();
        let reply: string;
        if (lower.includes("liquid") || lower.includes("depth") || lower.includes("slip")) {
          reply = await tools.show_liquidity_chart({ query: q });
        } else if (lower.includes("compar") || lower.includes("related")) {
          reply = await tools.open_comparison_widget({ query: q });
        } else if (lower.includes("open") || lower.includes("show") || lower.includes("grade")) {
          reply = await tools.open_market_page({ query: q });
        } else {
          reply = await tools.get_market_analysis({ query: q });
        }
        setMessages((m) => [...m, { role: "agent", text: reply }]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "agent", text: e instanceof Error ? e.message : "Request failed" },
      ]);
    } finally {
      setBusy(false);
    }
  }, [question, connected, sendUserMessage, tools]);

  return (
    <>
      <WidgetHost />
      <div className="pointer-events-none fixed top-[10vh] right-4 z-40 flex flex-col items-end gap-3 sm:right-6">
        {open && (
          <div className="pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[24px] border border-white/15 bg-[#0c0e12]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Thin Ice agent</p>
                <p className="text-[11px] text-[#8b95a1]">
                  Strands · ElevenLabs {voiceConfigured ? (connected ? "· live" : "· ready") : "· not configured"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#8b95a1] hover:text-white">
                Close
              </button>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed ${
                    m.role === "user" ? "text-[#9aebff]" : m.role === "system" ? "text-[#8b95a1]" : "text-[#d7dde4]"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide text-[#6f7882]">
                    {m.role === "user" ? "You" : m.role === "system" ? "Status" : "Agent"}
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-white/10 px-3 pt-3">
              {!connected ? (
                <button
                  type="button"
                  onClick={() => void activate()}
                  disabled={busy}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#101216] disabled:opacity-50"
                >
                  Activate voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void endVoice()}
                  className="rounded-full bg-[#3a1c24] px-3 py-1.5 text-xs font-semibold text-[#ff8b98]"
                >
                  End voice
                </button>
              )}
              <button
                type="button"
                onClick={() => void tools.open_market_widget({})}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/30"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => void tools.show_liquidity_chart({})}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/30"
              >
                Liquidity
              </button>
              <button
                type="button"
                onClick={() => void tools.open_comparison_widget({})}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/30"
              >
                Compare
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void askText();
              }}
              className="border-t border-white/10 p-3"
            >
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about a market…"
                  className="h-10 flex-1 rounded-full border border-white/10 bg-[#1a1d24] px-3 text-sm text-white outline-none placeholder:text-[#6f7882]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 rounded-full bg-white px-3 text-xs font-semibold text-[#101216] disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open && !connected) void activate();
          }}
          aria-label="Open Thin Ice agent"
          className="pointer-events-auto h-[88px] w-[88px] overflow-hidden rounded-full border border-white/15 bg-[#0c0e12]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-white/30 sm:h-[104px] sm:w-[104px]"
        >
          <div className="relative h-full w-full">
            <Strands
              listening={listening}
              level={level}
              energy={listening ? 0.9 : 0.55}
              glass
              glassSize={1.05}
              interactive
              clickPulse
              intensity={1.05}
              className="h-full w-full"
            />
          </div>
        </button>
      </div>
    </>
  );
}
