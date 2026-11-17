import type { Grade } from "@/lib/api";

// Color is never the only signal: the letter and a word always show.
const STYLE: Record<Grade, { cls: string; word: string }> = {
  A: { cls: "bg-emerald-600 text-white", word: "Deep" },
  B: { cls: "bg-emerald-500/80 text-white", word: "Solid" },
  C: { cls: "bg-amber-400 text-black", word: "Fair" },
  D: { cls: "bg-orange-500 text-white", word: "Thin" },
  F: { cls: "bg-red-600 text-white", word: "Thin ice" },
};

export function GradePill({ grade, large = false }: { grade: Grade; large?: boolean }) {
  const s = STYLE[grade];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s.cls} ${
        large ? "px-4 py-1.5 text-lg" : "px-2.5 py-0.5 text-sm"
      }`}
    >
      <span>{grade}</span>
      <span className="font-normal opacity-90">{s.word}</span>
    </span>
  );
}
