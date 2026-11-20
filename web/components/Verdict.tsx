import Link from "next/link";
import type { Verdict } from "@/lib/verdict";

const TONE: Record<Verdict["kind"], string> = {
  healthy: "text-[#8ee0b0]",
  fragile: "text-[#ffc46b]",
  inconsistent: "text-[#ff8b98]",
  insufficient: "text-[#b7c0ca]",
};

export function VerdictBlock({ verdict, compact = false }: { verdict: Verdict; compact?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-semibold ${TONE[verdict.kind]}`}>
        {verdict.title}
        {verdict.freshness !== "live" && verdict.kind !== "insufficient" ? (
          <span className="ml-1 font-medium text-[#8b95a1]">· {verdict.ageLabel}</span>
        ) : null}
      </p>
      <p className={`mt-1 text-sm leading-snug text-[#c5ced6] ${compact ? "line-clamp-3" : ""}`}>{verdict.reason}</p>
      {!compact && (
        <ul className="mt-3 space-y-1 text-sm text-[#9aa3ad]">
          {verdict.evidence.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <Link href={verdict.href} className="mt-3 inline-block text-sm font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
        {verdict.action}
      </Link>
    </div>
  );
}
