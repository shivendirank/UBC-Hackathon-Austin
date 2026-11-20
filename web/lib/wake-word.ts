/** Wake phrases for the Thin Ice voice orb. Matching is local; no audio leaves the browser. */
export const DEFAULT_WAKE_PHRASES = ["hey gemini", "ok gemini", "hi gemini"];

export function normalizeWake(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Earliest phrase hit in `transcript`. `rest` is speech that followed the phrase. */
export function findWake(transcript: string, phrases: string[] = DEFAULT_WAKE_PHRASES) {
  const t = normalizeWake(transcript);
  let best: { index: number; length: number } | null = null;
  for (const phrase of phrases) {
    const normalized = normalizeWake(phrase);
    if (!normalized) continue;
    const index = t.indexOf(normalized);
    if (index >= 0 && (best === null || index < best.index)) {
      best = { index, length: normalized.length };
    }
  }
  if (!best) return { matched: false, rest: "" };
  return { matched: true, rest: t.slice(best.index + best.length).trim() };
}

/**
 * Keep a short rolling window so "hey" and "gemini" from separate speech events
 * still match on the event that completes the phrase.
 */
export function rollWakeText(previous: string, chunk: string, maxWords = 12) {
  const words = normalizeWake(`${previous} ${chunk}`).split(" ").filter(Boolean);
  return words.slice(-maxWords).join(" ");
}
