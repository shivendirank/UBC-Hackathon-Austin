"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversationControls, useConversationStatus, type HookOptions } from "@elevenlabs/react";
import Strands from "@/components/react-bits/Strands";
import { WidgetHost } from "@/components/copilot/WidgetHost";
import { useActiveMarket } from "@/lib/active-market";
import { createCopilotSession, fetchCopilotStatus } from "@/lib/copilot-api";
import { buildClientTools } from "@/lib/copilot-tools";
import { useWakeWord, wakeWordSupported } from "@/lib/use-wake-word";
import { useWidgets } from "@/lib/widgets";

type Msg = { role: "user" | "agent" | "system"; text: string; eventId?: number };

const WARM_MS = 8 * 60 * 1000;

type WarmSession = {
  configured: boolean;
  conversation_token?: string | null;
  signed_url?: string | null;
  agent_id?: string;
  error?: string;
  reason?: string;
  fetchedAt: number;
};

/**
 * The ElevenLabs SDK asks for the mic with voiceIsolation, and that constraint
 * can leave getUserMedia pending on Windows. Strip it and fail clearly instead
 * of sitting on "Opening" until we invent a timeout.
 */
function prepareMicForAgent() {
  const md = navigator.mediaDevices;
  const tagged = md as MediaDevices & { __thinIceMic?: boolean };
  if (!md || tagged.__thinIceMic) return;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = (constraints) => {
    let next = constraints;
    if (next && typeof next.audio === "object" && next.audio) {
      const audio = { ...next.audio };
      delete (audio as { voiceIsolation?: boolean }).voiceIsolation;
      next = { ...next, audio };
    }
    return Promise.race([
      orig(next),
      new Promise<MediaStream>((_, reject) => {
        window.setTimeout(
          () =>
            reject(
              new Error(
                "Microphone did not open. Allow the mic in the address bar, and close other Thin Ice tabs that are holding it.",
              ),
            ),
          8000,
        );
      }),
    ]);
  };
  tagged.__thinIceMic = true;
}

/** Short tone once the mic is live, so speech starts after the session is open. */
function playReadyTone() {
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  void ctx.resume();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(990, t + 0.08);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
  osc.onended = () => void ctx.close();
}

/**
 * Jag's Strands orb + Thin Ice ElevenLabs session/tools/widgets.
 */
export function CompareAgent({ symbols = [] }: { symbols?: string[] }) {
  const router = useRouter();
  const { symbol, title, setActiveMarket } = useActiveMarket();
  const widgets = useWidgets();
  const { startSession, endSession, sendUserMessage } = useConversationControls();
  const { status, message: statusMessage } = useConversationStatus();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [wakeArmed, setWakeArmed] = useState(false);
  const [needsWakeGesture, setNeedsWakeGesture] = useState(false);
  /** Visible at load; slides off-screen on scroll; wake / inquire brings it back. */
  const [orbVisible, setOrbVisible] = useState(true);
  const [inquiring, setInquiring] = useState(false);
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      text: "Say “Hey Gemini”. I’ll open, then a tone means you can start talking. I use Thin Ice tools for real grades — I don’t invent odds.",
    },
  ]);
  const sessionBusy = useRef(false);
  const openingRef = useRef(false);
  const chimeRef = useRef(false);
  const sawConnecting = useRef(false);
  const warmRef = useRef<WarmSession | null>(null);
  const warmInflight = useRef<Promise<WarmSession> | null>(null);
  const symbolRef = useRef(symbol);
  const symbolsRef = useRef(symbols);
  symbolRef.current = symbol;
  symbolsRef.current = symbols;
  const activateRef = useRef<() => Promise<void>>(async () => {});
  const stopWakeRef = useRef<(waitForRelease?: boolean) => Promise<void>>(async () => {});
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inquiringRef = useRef(false);
  inquiringRef.current = inquiring;

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const appendTranscript = useCallback((role: Msg["role"], text: string, eventId?: number) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => {
      if (eventId != null && m.some((x) => x.eventId === eventId)) return m;
      const last = m[m.length - 1];
      if (last && last.role === role && last.text === trimmed) return m;
      return [...m, { role, text: trimmed, eventId }];
    });
    setOpen(true);
  }, []);

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

  const prefetchSession = useCallback(async (force = false): Promise<WarmSession> => {
    const cached = warmRef.current;
    if (!force && cached) {
      const fresh = Boolean(cached.conversation_token || cached.signed_url);
      const ttl = fresh ? WARM_MS : 15_000;
      if (Date.now() - cached.fetchedAt < ttl) return cached;
    }
    if (!force && warmInflight.current) return warmInflight.current;
    const run = createCopilotSession({
      symbol: symbolRef.current ?? symbolsRef.current[0] ?? null,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    })
      .then((sess) => {
        const warm: WarmSession = { ...sess, fetchedAt: Date.now() };
        warmRef.current = warm;
        if (sess.configured) setVoiceConfigured(true);
        return warm;
      })
      .finally(() => {
        if (warmInflight.current === run) warmInflight.current = null;
      });
    warmInflight.current = run;
    return run;
  }, []);

  // Mint the WebRTC token while wake-word listening is idle, so "Hey Gemini" does not wait on the network.
  useEffect(() => {
    prepareMicForAgent();
    void prefetchSession().catch(() => {});
    const timer = window.setInterval(() => {
      void prefetchSession(true).catch(() => {});
    }, 7 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [prefetchSession]);

  const dockIfScrolled = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.scrollY >= 56) setOrbVisible(false);
  }, []);

  useEffect(() => {
    if (status === "connecting") {
      sawConnecting.current = true;
      return;
    }
    if (status === "connected") {
      sawConnecting.current = false;
      openingRef.current = false;
      setOpening(false);
      setInquiring(true);
      setOrbVisible(true);
      setLevel(0.7);
      if (chimeRef.current) {
        chimeRef.current = false;
        playReadyTone();
        appendTranscript("system", "You're on. Start talking.");
      }
      return;
    }
    setLevel(undefined);
    const failedOpen =
      chimeRef.current && (status === "error" || (status === "disconnected" && sawConnecting.current));
    if (!failedOpen) return;
    sawConnecting.current = false;
    chimeRef.current = false;
    openingRef.current = false;
    setOpening(false);
    setInquiring(false);
    appendTranscript("agent", statusMessage || "Voice didn't open. Say “Hey Gemini” to try again.");
    dockIfScrolled();
  }, [status, statusMessage, appendTranscript, dockIfScrolled]);

  // Dock into the right edge once the user scrolls; stay out while inquiring.
  useEffect(() => {
    const SCROLL_HIDE_PX = 56;
    const sync = () => {
      if (inquiringRef.current) {
        setOrbVisible(true);
        return;
      }
      setOrbVisible(window.scrollY < SCROLL_HIDE_PX);
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  const connected = status === "connected";
  const voiceLive = !gaveUp && (connected || opening || status === "connecting");
  const listening = voiceLive || busy || wakeArmed;

  const beginSession = useCallback(
    (sess: WarmSession) => {
      prepareMicForAgent();
      const ready = Boolean(sess.conversation_token || sess.signed_url || sess.agent_id);
      if (!sess.configured || !ready) {
        openingRef.current = false;
        chimeRef.current = false;
        setOpening(false);
        setVoiceConfigured(false);
        setInquiring(false);
        appendTranscript(
          "agent",
          sess.reason ||
            sess.error ||
            "ElevenLabs is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in backend/.env.",
        );
        dockIfScrolled();
        sessionBusy.current = false;
        return;
      }
      setVoiceConfigured(true);
      const opts: HookOptions = {
        clientTools: tools,
        dynamicVariables: {
          market_symbol: symbol ?? symbols[0] ?? "",
          market_title: title ?? "",
          app_path: typeof window !== "undefined" ? window.location.pathname : "",
        },
        connectionDelay: { default: 0 },
        onMessage: ({ message, role, event_id }) => {
          appendTranscript(role === "user" ? "user" : "agent", message, event_id);
        },
        onModeChange: ({ mode }) => {
          setLevel(mode === "speaking" ? 1 : 0.65);
        },
      };
      if (sess.signed_url) {
        opts.signedUrl = sess.signed_url;
        opts.connectionType = "websocket";
      } else if (sess.conversation_token) {
        opts.conversationToken = sess.conversation_token;
        opts.connectionType = "webrtc";
      } else if (sess.agent_id) {
        opts.agentId = sess.agent_id;
        opts.connectionType = "websocket";
      }
      // Must run in the click turn. Awaiting first suspends the mic and the session never connects.
      startSession(opts);
      sessionBusy.current = false;
    },
    [symbol, symbols, title, tools, startSession, appendTranscript, dockIfScrolled],
  );

  const activate = useCallback(() => {
    if (sessionBusy.current || openingRef.current || status === "connected" || status === "connecting") return;
    sessionBusy.current = true;
    openingRef.current = true;
    chimeRef.current = true;
    setGaveUp(false);
    setOpening(true);
    setInquiring(true);
    setOrbVisible(true);
    setOpen(true);
    setBusy(true);
    appendTranscript("system", "Opening the microphone…");
    void stopWakeRef.current(false);
    const cached = warmRef.current;
    const cachedReady = Boolean(cached && (cached.signed_url || cached.conversation_token) && cached.configured);
    if (cached && cachedReady) {
      if (warmRef.current?.fetchedAt === cached.fetchedAt) warmRef.current = null;
      void prefetchSession(true);
      beginSession(cached);
      setBusy(false);
      return;
    }
    void prefetchSession(true)
      .then((sess) => {
        if (warmRef.current?.fetchedAt === sess.fetchedAt) warmRef.current = null;
        beginSession(sess);
      })
      .catch((e) => {
        openingRef.current = false;
        chimeRef.current = false;
        setOpening(false);
        setInquiring(false);
        appendTranscript("agent", e instanceof Error ? e.message : "Could not start voice session");
        dockIfScrolled();
        sessionBusy.current = false;
      })
      .finally(() => setBusy(false));
  }, [status, prefetchSession, beginSession, appendTranscript, dockIfScrolled]);

  activateRef.current = activate;

  const {
    supported: wakeSupported,
    listening: wakeListening,
    lastHeard,
    stop: stopWake,
  } = useWakeWord({
    enabled: wakeArmed,
    paused: voiceLive,
    onWake: () => {
      setInquiring(true);
      setOrbVisible(true);
      setOpen(true);
      void activateRef.current();
    },
  });
  stopWakeRef.current = stopWake;

  const armWake = useCallback(async (opts?: { silent?: boolean }) => {
    if (!wakeWordSupported()) {
      setNeedsWakeGesture(false);
      return false;
    }
    prepareMicForAgent();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // free mic for SpeechRecognition / ElevenLabs
    } catch {
      if (!opts?.silent) {
        setOpen(true);
        appendTranscript("system", "Microphone permission is required for “Hey Gemini”.");
      }
      setNeedsWakeGesture(true);
      return false;
    }
    setWakeArmed(true);
    setNeedsWakeGesture(false);
    try {
      sessionStorage.setItem("thin_ice_wake_armed", "1");
    } catch {
      /* private mode */
    }
    if (!opts?.silent) {
      appendTranscript("system", "Listening for “Hey Gemini” — no need to touch the orb.");
    }
    return true;
  }, [appendTranscript]);

  // Hands-free: auto-arm if mic already allowed; else one click anywhere on the page (not the orb).
  useEffect(() => {
    if (!wakeWordSupported()) return;
    let cancelled = false;

    const tryAuto = async () => {
      try {
        const perm = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (cancelled) return;
        if (perm?.state === "granted" || sessionStorage.getItem("thin_ice_wake_armed") === "1") {
          await armWake({ silent: true });
          return;
        }
      } catch {
        /* permissions API missing */
      }
      if (!cancelled) setNeedsWakeGesture(true);
    };

    void tryAuto();

    const onFirstGesture = () => {
      void armWake({ silent: true });
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true, capture: true });
    window.addEventListener("keydown", onFirstGesture, { once: true, capture: true });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
    };
  }, [armWake]);

  const endVoice = useCallback(async () => {
    sessionBusy.current = false;
    openingRef.current = false;
    chimeRef.current = false;
    setOpening(false);
    try {
      await endSession();
    } catch {
      /* none */
    }
    setInquiring(false);
    setOpen(false);
    setMessages((m) => [...m, { role: "system", text: "Voice ended. Wake word listening resumes if armed." }]);
    // Let status settle, then slide away if the page is scrolled.
    window.setTimeout(() => dockIfScrolled(), 80);
  }, [endSession, dockIfScrolled]);

  // When a live session drops on its own, treat inquiry as done.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
      return;
    }
    if (!wasConnected.current) return;
    wasConnected.current = false;
    if (sessionBusy.current || busy) return;
    setInquiring(false);
    setOpen(false);
    dockIfScrolled();
  }, [connected, busy, dockIfScrolled]);

  const askText = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    appendTranscript("user", q);
    setBusy(true);
    try {
      if (connected && sendUserMessage) {
        await sendUserMessage(q);
        // Agent reply arrives via onMessage into the transcript
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
        appendTranscript("agent", reply);
      }
    } catch (e) {
      appendTranscript("agent", e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, [question, connected, sendUserMessage, tools, appendTranscript]);

  const chip =
    "rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-[#e8eef4] backdrop-blur-md transition hover:border-white/30 hover:bg-white/[0.1]";

  return (
    <>
      <WidgetHost />
      <div
        className={`pointer-events-none fixed top-[11.5vh] right-4 z-40 flex flex-col items-end gap-3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:right-6 ${
          orbVisible ? "translate-x-0" : "translate-x-[calc(100%+1.5rem)]"
        }`}
        aria-hidden={!orbVisible}
      >
        {open && orbVisible && (
          <div className="pointer-events-auto w-[min(100vw-2rem,23rem)] overflow-hidden rounded-[22px] border border-white/20 bg-[rgba(12,16,22,0.55)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/10 backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-transparent bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-white">Thin Ice agent</p>
                <p className="mt-0.5 text-[11px] text-[#9aa3ad]">
                  {connected
                    ? "You're on · start talking"
                    : voiceLive
                      ? "Opening — talk after the tone"
                      : wakeArmed && wakeListening
                        ? "Listening for “Hey Gemini”"
                        : wakeArmed
                          ? "Wake armed · say “Hey Gemini”"
                          : voiceConfigured
                            ? "Voice ready"
                            : "Voice not configured"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected
                      ? "bg-[#9aebff] shadow-[0_0_10px_rgba(154,235,255,0.7)]"
                      : wakeListening
                        ? "animate-pulse bg-[#9aebff]/80"
                        : "bg-white/25"
                  }`}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!connected && !busy) {
                      setInquiring(false);
                      dockIfScrolled();
                    }
                  }}
                  className="rounded-full px-2 py-1 text-xs text-[#9aa3ad] transition hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>

            <div ref={transcriptRef} className="max-h-72 space-y-2.5 overflow-y-auto px-3 py-3">
              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const isSystem = m.role === "system";
                return (
                  <div
                    key={m.eventId != null ? `e-${m.eventId}` : `i-${i}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                        isUser
                          ? "rounded-br-md border border-[#9aebff]/25 bg-[#9aebff]/15 text-[#e8f9ff]"
                          : isSystem
                            ? "border border-white/10 bg-white/[0.04] text-[#9aa3ad]"
                            : "rounded-bl-md border border-white/12 bg-white/[0.08] text-[#e6ebf0]",
                      ].join(" ")}
                    >
                      <p className="mb-1 text-[10px] font-medium text-[#8b95a1]">
                        {isUser ? "You" : isSystem ? "Status" : "Agent"}
                      </p>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 bg-white/[0.03] px-3 py-3">
              {!connected ? (
                <button
                  type="button"
                  onClick={() => void activate()}
                  disabled={busy || voiceLive}
                  className="rounded-full bg-[#9aebff] px-3.5 py-1.5 text-xs font-semibold text-[#0b1016] transition hover:bg-[#b5f1ff] disabled:opacity-50"
                >
                  Activate voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void endVoice()}
                  className="rounded-full border border-[#ff8b98]/35 bg-[#ff8b98]/15 px-3.5 py-1.5 text-xs font-semibold text-[#ffb3bc]"
                >
                  End voice
                </button>
              )}
              {wakeSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (wakeArmed) {
                      setWakeArmed(false);
                      appendTranscript("system", "Wake word disarmed.");
                    } else {
                      void armWake();
                    }
                  }}
                  disabled={connected}
                  className={`${chip} disabled:opacity-40 ${wakeArmed ? "border-[#9aebff]/40 text-[#9aebff]" : ""}`}
                >
                  {wakeArmed ? "Wake on" : "Arm wake"}
                </button>
              )}
              <button type="button" onClick={() => void tools.open_market_widget({})} className={chip}>
                Overview
              </button>
              <button type="button" onClick={() => void tools.show_liquidity_chart({})} className={chip}>
                Liquidity
              </button>
              <button type="button" onClick={() => void tools.open_comparison_widget({})} className={chip}>
                Compare
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void askText();
              }}
              className="border-t border-white/10 bg-white/[0.04] p-3"
            >
              <div className="flex gap-2 rounded-2xl border border-white/15 bg-black/25 p-1.5 backdrop-blur-md">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about a market…"
                  className="h-9 flex-1 rounded-xl bg-transparent px-3 text-sm text-white outline-none placeholder:text-[#6f7882]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 rounded-xl bg-white/90 px-3.5 text-xs font-semibold text-[#101216] transition hover:bg-white disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
            </form>
          </div>
        )}

        {orbVisible && (wakeArmed || voiceLive) && !connected && (
          <p className="pointer-events-none max-w-[11rem] text-right text-[10px] leading-snug text-[#9aa3ad]">
            {voiceLive
              ? "Opening — start talking after the tone"
              : wakeListening
                ? "Listening — say “Hey Gemini”"
                : "Starting wake listener…"}
            {lastHeard ? <span className="mt-0.5 block truncate text-[#6f7882]">Heard: {lastHeard}</span> : null}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setOrbVisible(true);
            setOpen((v) => !v);
          }}
          aria-label="Open Thin Ice agent transcript"
          tabIndex={orbVisible ? 0 : -1}
          className={`pointer-events-auto h-[53px] w-[53px] overflow-hidden rounded-full border bg-[rgba(12,16,22,0.45)] shadow-[0_12px_40px_rgba(0,0,0,0.4)] ring-1 ring-inset backdrop-blur-xl transition sm:h-[63px] sm:w-[63px] ${
            (wakeListening || voiceLive) && !connected
              ? "border-[#9aebff]/50 ring-[#9aebff]/20"
              : "border-white/25 ring-white/15 hover:border-white/40"
          } ${orbVisible ? "" : "pointer-events-none"}`}
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
