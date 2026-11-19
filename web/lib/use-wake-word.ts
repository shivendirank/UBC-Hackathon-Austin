"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal SpeechRecognition shape (Chrome/Edge). */
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ 0?: { transcript?: string } } & { isFinal?: boolean }> }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecCtor = new () => SpeechRec;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  }
}

const DEFAULT_PHRASES = ["hey gemini", "ok gemini", "hi gemini"];

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesWake(transcript: string, phrases: string[]) {
  const t = normalize(transcript);
  return phrases.some((p) => t.includes(normalize(p)));
}

export function wakeWordSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Browser wake-word via Web Speech API (Chrome/Edge).
 * Must be paused while ElevenLabs holds the mic.
 */
export function useWakeWord(opts: {
  enabled: boolean;
  paused: boolean;
  phrases?: string[];
  onWake: () => void;
}) {
  const { enabled, paused, onWake } = opts;
  const phrases = opts.phrases ?? DEFAULT_PHRASES;
  const [supported] = useState(() => wakeWordSupported());
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const onWakeRef = useRef(onWake);
  const phrasesRef = useRef(phrases);
  const firingRef = useRef(false);

  onWakeRef.current = onWake;
  phrasesRef.current = phrases;

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!wakeWordSupported()) return;
    stop();
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let chunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        chunk += ev.results[i]?.[0]?.transcript ?? "";
      }
      const heard = chunk.trim();
      if (heard) setLastHeard(heard);
      if (!matchesWake(chunk, phrasesRef.current)) return;
      if (firingRef.current) return;
      firingRef.current = true;
      try {
        rec.stop();
      } catch {
        /* */
      }
      onWakeRef.current();
      window.setTimeout(() => {
        firingRef.current = false;
      }, 2500);
    };

    rec.onerror = () => {
      /* network/no-speech — onend will restart if still armed */
    };

    rec.onend = () => {
      if (recRef.current !== rec) return;
      // Chrome drops continuous sessions; restart while still armed
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [stop]);

  useEffect(() => {
    if (!enabled || paused || !supported) {
      stop();
      return;
    }
    start();
    return () => stop();
  }, [enabled, paused, supported, start, stop]);

  return { supported, listening, lastHeard, stop };
}
