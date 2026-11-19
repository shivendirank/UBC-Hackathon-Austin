"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Strands from "@/components/react-bits/Strands";
import { API_URL, type Market } from "@/lib/api";

type Msg = { role: "user" | "agent"; text: string };

function brief(markets: Market[], question: string): string {
  if (markets.length === 0) {
    return "No graded markets are loaded yet. Refresh Markets after the recorder has pulled Gemini books.";
  }
  const lines = [
    "Frontend compare brief from the live grades already on this page:",
    "",
  ];
  for (const m of markets.slice(0, 6)) {
    const odds = m.odds_pct == null ? "—" : `${m.odds_pct.toFixed(0)}%`;
    const depth = m.score?.depth_pct;
    const depthBit = typeof depth === "number" ? `, ${Math.round(depth)}% of side in the 10¢ window` : "";
    lines.push(
      `• ${m.label ?? m.symbol} — “${m.event_title}”: ${odds} YES, grade ${m.grade}, $${m.move_cost_usd} to move 10¢${depthBit}.`,
    );
  }
  lines.push("");
  lines.push(
    "When comparing, check settlement rules, synced books, and whether a disagreement is executable after fees. A displayed mismatch is not automatically tradeable.",
  );
  if (question.trim()) {
    lines.push("");
    lines.push(`You asked: ${question.trim()}`);
  }
  return lines.join("\n");
}

export function CompareAgent({ symbols = [] }: { symbols?: string[] }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      text: "Ask me to compare related markets. I’ll read the live grades from Thin Ice in your browser — no extra backend agent.",
    },
  ]);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      recogRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  async function loadMarkets(): Promise<Market[]> {
    const r = await fetch(`${API_URL}/api/markets?limit=500&sort=deep`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as { markets?: Market[] };
    const all = data.markets ?? [];
    if (symbols.length === 0) return all.filter((m) => m.odds_pct != null).slice(0, 6);
    const want = new Set(symbols);
    const picked = all.filter((m) => want.has(m.symbol));
    return picked.length > 0 ? picked : all.filter((m) => m.odds_pct != null).slice(0, 6);
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.slice(0, 600));
    utter.rate = 1.02;
    setLevel(0.65);
    utter.onend = () => setLevel(undefined);
    utter.onerror = () => setLevel(undefined);
    window.speechSynthesis.speak(utter);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setListening(true);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    try {
      const markets = await loadMarkets();
      const reply = brief(markets, q);
      setMessages((m) => [...m, { role: "agent", text: reply }]);
      speak(reply);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", text: "Could not load market grades from the API." },
      ]);
    } finally {
      setBusy(false);
      setListening(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  function toggleMic() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setListening((v) => !v);
      return;
    }
    if (recogRef.current) {
      recogRef.current.stop();
      recogRef.current = null;
      setListening(false);
      return;
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript;
      if (said) void ask(said);
    };
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
    };
    recog.onerror = () => {
      setListening(false);
      recogRef.current = null;
    };
    recogRef.current = recog;
    setListening(true);
    recog.start();
  }

  return (
    <div className="pointer-events-none fixed top-[10vh] right-4 z-40 flex flex-col items-end gap-3 sm:right-6">
      {open && (
        <div className="pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[24px] border border-white/15 bg-[#0c0e12]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Compare agent</p>
              <p className="text-[11px] text-[#8b95a1]">Frontend · Strands orb</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#8b95a1] hover:text-white">
              Close
            </button>
          </div>
          <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm leading-relaxed ${m.role === "user" ? "text-[#9aebff]" : "text-[#d7dde4]"}`}>
                <span className="text-[10px] uppercase tracking-wide text-[#6f7882]">
                  {m.role === "user" ? "You" : "Agent"}
                </span>
                <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={onSubmit} className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Compare these odds…"
                className="h-10 flex-1 rounded-full border border-white/10 bg-[#1a1d24] px-3 text-sm text-white outline-none placeholder:text-[#6f7882]"
              />
              <button
                type="button"
                onClick={toggleMic}
                className={`h-10 rounded-full px-3 text-xs font-semibold ${listening ? "bg-[#3a1c24] text-[#ff8b98]" : "bg-[#22262d] text-white"}`}
              >
                Mic
              </button>
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
        onClick={() => setOpen((v) => !v)}
        aria-label="Open compare agent"
        className="pointer-events-auto h-[88px] w-[88px] overflow-hidden rounded-full border border-white/15 bg-[#0c0e12]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-white/30 sm:h-[104px] sm:w-[104px]"
      >
        <div className="relative h-full w-full">
          <Strands
            listening={listening || busy}
            level={level}
            energy={busy || listening ? 0.9 : 0.55}
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
  );
}
