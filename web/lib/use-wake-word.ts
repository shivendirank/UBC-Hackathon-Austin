"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_WAKE_PHRASES, findWake, rollWakeText } from "@/lib/wake-word";

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
  const phrases = opts.phrases ?? DEFAULT_WAKE_PHRASES;
  const [supported] = useState(() => wakeWordSupported());
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const onWakeRef = useRef(onWake);
  const phrasesRef = useRef(phrases);
  const firingRef = useRef(false);
  const recentRef = useRef("");

  onWakeRef.current = onWake;
  phrasesRef.current = phrases;

  const stop = useCallback((waitForRelease = false) => {
    const rec = recRef.current;
    recRef.current = null;
    setListening(false);
    if (!rec) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      // Windows will not hand the mic to ElevenLabs until SpeechRecognition fires onend.
      const timer = window.setTimeout(finish, waitForRelease ? 800 : 0);
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = () => {
        window.clearTimeout(timer);
        finish();
      };
      try {
        rec.stop();
      } catch {
        window.clearTimeout(timer);
        finish();
      }
    });
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
      const heard = rollWakeText(recentRef.current, chunk);
      recentRef.current = heard;
      if (heard) setLastHeard(heard);
      if (!findWake(heard, phrasesRef.current).matched) return;
      if (firingRef.current) return;
      firingRef.current = true;
      recentRef.current = "";
      // Wait until recognition ends so it cannot restart and keep the mic.
      void stop(true).then(() => onWakeRef.current());
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
