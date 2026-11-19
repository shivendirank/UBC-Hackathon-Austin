/** Category marks from the Icons8 Flat Color pack. Ids are locked in icons8.json. */

export type StickerKind =
  | "helmet" | "hoop" | "puck" | "crest" | "coin" | "barrel" | "cloud" | "columns" | "ballot" | "chip" | "ice";

const ICONS: Record<StickerKind, { id: string }> = {
  helmet: { id: "63086" },
  hoop: { id: "12969" },
  puck: { id: "16907" },
  crest: { id: "84301" },
  coin: { id: "63192" },
  barrel: { id: "FDsBBEyrn6q8" },
  cloud: { id: "11871" },
  columns: { id: "12985" },
  ballot: { id: "23429" },
  chip: { id: "13105" },
  ice: { id: "17365" },
};

export function stickerKind(
  category?: string | null,
  title?: string | null,
  ticker?: string | null,
): StickerKind {
  const blob = `${ticker ?? ""} ${title ?? ""}`.toUpperCase();
  if (/\b(BTC|BITCOIN)\b/.test(blob)) return "coin";
  if (/\b(NFL|NCAAF)\b/.test(blob) || blob.includes("FOOTBALL") || blob.includes("YARDS") || blob.includes("TOUCHDOWN")) return "helmet";
  if (/\b(NBA|NCAAM)\b/.test(blob) || blob.includes("BASKET")) return "hoop";
  if (blob.includes("NHL") || blob.includes("HOCKEY")) return "puck";
  if (/\b(LIGA|SOCCER|MLS|EPL)\b/.test(blob)) return "crest";
  const c = (category ?? "").toLowerCase();
  if (c.includes("crypto")) return "coin";
  if (c.includes("politic")) return "ballot";
  if (c.includes("econ")) return "columns";
  if (c.includes("sport")) return "helmet";
  if (c.includes("commod") || c.includes("energy") || c.includes("oil")) return "barrel";
  if (c.includes("weather")) return "cloud";
  if (c.includes("tech") || c.includes("business")) return "chip";
  return "ice";
}

export function Sticker({
  category,
  title,
  ticker,
  className = "h-14 w-14",
  animated = false,
}: {
  category?: string | null;
  title?: string | null;
  ticker?: string | null;
  className?: string;
  animated?: boolean;
}) {
  const icon = ICONS[stickerKind(category, title, ticker)];
  return (
    <span className={`sticker inline-block ${animated ? "sticker-live" : ""} ${className}`} aria-hidden>
      <img
        src={`https://img.icons8.com/?id=${icon.id}&format=png&size=128`}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
