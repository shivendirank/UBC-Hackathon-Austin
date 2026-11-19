"use client";

/**
 * Market marks: real crypto SVG logos + Twemoji (Unicode emoji SVGs).
 * No generative / placeholder art.
 */

import { useState } from "react";

const CRYPTO_CDN = "https://cdn.jsdelivr.net/gh/madenix/Crypto-logo-cdn@main/Logos";
const TWEMOJI_CDN = "https://cdn.jsdelivr.net/npm/@twemoji/svg";

/** Official-ish logos for Gemini crypto markets. */
const CRYPTO_LOGOS: Record<string, string> = {
  BTC: "BTC.svg",
  BITCOIN: "BTC.svg",
  ETH: "ETH.svg",
  ETHEREUM: "ETH.svg",
  SOL: "SOL.svg",
  SOLANA: "SOL.svg",
  XRP: "XRP.svg",
  DOGE: "DOGE.svg",
  DOGECOIN: "DOGE.svg",
  ADA: "ADA.svg",
  CARDANO: "ADA.svg",
  AVAX: "AVAX.svg",
  LINK: "LINK.svg",
  LTC: "LTC.svg",
  LITECOIN: "LTC.svg",
  DOT: "DOT.svg",
  MATIC: "MATIC.svg",
  POLYGON: "MATIC.svg",
  BNB: "BNB.svg",
  SHIB: "SHIB.svg",
  UNI: "UNI.svg",
  ATOM: "ATOM.svg",
  NEAR: "NEAR.svg",
  SUI: "SUI.svg",
  TON: "TON.svg",
  TRX: "TRON.svg",
  XLM: "XLM.svg",
};

type EmojiMark = { type: "emoji"; code: string; char: string; label: string };
type CryptoMark = { type: "crypto"; file: string; label: string };
type Mark = EmojiMark | CryptoMark;

const EMOJI = {
  football: { type: "emoji", code: "1f3c8", char: "🏈", label: "Football" } as EmojiMark,
  basketball: { type: "emoji", code: "1f3c0", char: "🏀", label: "Basketball" } as EmojiMark,
  hockey: { type: "emoji", code: "1f3d2", char: "🏒", label: "Hockey" } as EmojiMark,
  soccer: { type: "emoji", code: "26bd", char: "⚽", label: "Soccer" } as EmojiMark,
  politics: { type: "emoji", code: "1f5f3", char: "🗳️", label: "Politics" } as EmojiMark,
  economy: { type: "emoji", code: "1f3db", char: "🏛️", label: "Economy" } as EmojiMark,
  weather: { type: "emoji", code: "2601", char: "☁️", label: "Weather" } as EmojiMark,
  energy: { type: "emoji", code: "1f6e2", char: "🛢️", label: "Energy" } as EmojiMark,
  tech: { type: "emoji", code: "1f4bb", char: "💻", label: "Tech" } as EmojiMark,
  coin: { type: "emoji", code: "1fa99", char: "🪙", label: "Crypto" } as EmojiMark,
  ice: { type: "emoji", code: "2744", char: "❄️", label: "Thin Ice" } as EmojiMark,
};

function detectCrypto(blob: string): CryptoMark | null {
  // Prefer explicit tickers in Gemini symbols like GEMI-BTC… / GEMI-ETH…
  for (const key of Object.keys(CRYPTO_LOGOS)) {
    if (new RegExp(`\\b${key}\\b`).test(blob)) {
      return { type: "crypto", file: CRYPTO_LOGOS[key], label: key };
    }
  }
  return null;
}

export function resolveMark(
  category?: string | null,
  title?: string | null,
  ticker?: string | null,
): Mark {
  const blob = `${ticker ?? ""} ${title ?? ""}`.toUpperCase();
  const crypto = detectCrypto(blob);
  if (crypto) return crypto;

  if (/\b(NFL|NCAAF)\b/.test(blob) || blob.includes("FOOTBALL") || blob.includes("YARDS") || blob.includes("TOUCHDOWN")) {
    return EMOJI.football;
  }
  if (/\b(NBA|NCAAM)\b/.test(blob) || blob.includes("BASKET")) return EMOJI.basketball;
  if (blob.includes("NHL") || blob.includes("HOCKEY")) return EMOJI.hockey;
  if (/\b(LIGA|SOCCER|MLS|EPL|FIFA)\b/.test(blob)) return EMOJI.soccer;

  const c = (category ?? "").toLowerCase();
  if (c.includes("crypto")) return EMOJI.coin;
  if (c.includes("politic")) return EMOJI.politics;
  if (c.includes("econ")) return EMOJI.economy;
  if (c.includes("sport")) return EMOJI.football;
  if (c.includes("commod") || c.includes("energy") || c.includes("oil")) return EMOJI.energy;
  if (c.includes("weather")) return EMOJI.weather;
  if (c.includes("tech") || c.includes("business")) return EMOJI.tech;
  return EMOJI.ice;
}

/** @deprecated use resolveMark — kept for any old imports */
export function stickerKind(
  category?: string | null,
  title?: string | null,
  ticker?: string | null,
): string {
  const m = resolveMark(category, title, ticker);
  return m.type === "crypto" ? m.label.toLowerCase() : m.code;
}

export function Sticker({
  category,
  title,
  ticker,
  className = "h-10 w-10",
  animated = false,
}: {
  category?: string | null;
  title?: string | null;
  ticker?: string | null;
  className?: string;
  animated?: boolean;
}) {
  const mark = resolveMark(category, title, ticker);
  const [emojiBroken, setEmojiBroken] = useState(false);

  if (mark.type === "crypto") {
    return (
      <span
        className={`sticker inline-flex items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5 ${animated ? "sticker-live" : ""} ${className}`}
        aria-hidden
        title={mark.label}
      >
        <img
          src={`${CRYPTO_CDN}/${mark.file}`}
          alt=""
          draggable={false}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`sticker inline-flex items-center justify-center ${animated ? "sticker-live" : ""} ${className}`}
      aria-hidden
      title={mark.label}
    >
      {emojiBroken ? (
        <span className="flex h-full w-full items-center justify-center text-[1.75em] leading-none">{mark.char}</span>
      ) : (
        <img
          src={`${TWEMOJI_CDN}/${mark.code}.svg`}
          alt=""
          draggable={false}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setEmojiBroken(true)}
        />
      )}
    </span>
  );
}
