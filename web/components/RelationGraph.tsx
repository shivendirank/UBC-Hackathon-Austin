"use client";

import Link from "next/link";
import { useState } from "react";

export type GraphNode = {
  symbol: string;
  label: string;
  event: string;
  pct: string;
  verdict: string;
};

export function RelationGraph({
  nodes,
  edge,
  verified,
  violated,
}: {
  nodes: GraphNode[];
  edge: string;
  verified: boolean;
  violated: boolean;
}) {
  const [selected, setSelected] = useState(nodes[0]?.symbol ?? "");
  const current = nodes.find((n) => n.symbol === selected) ?? nodes[0];
  const stroke = !verified ? "#d7a15a" : violated ? "#ff6b81" : "#7dcea0";
  if (!current) return null;

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2" role="list">
        {nodes.map((node, i) => (
          <div key={node.symbol} className="flex items-center gap-3">
            <button
              type="button"
              role="listitem"
              aria-pressed={node.symbol === current.symbol}
              onClick={() => setSelected(node.symbol)}
              className={`w-52 shrink-0 rounded-2xl border px-4 py-3 text-left ${node.symbol === current.symbol ? "border-white bg-[#1c2128]" : "border-white/10 bg-[#12141a]"}`}
            >
              <span className="block text-sm font-medium text-white">{node.label}</span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums text-white">{node.pct}</span>
              <span className="mt-1 block text-xs text-[#9aa3ad]">{node.verdict}</span>
            </button>
            {i < nodes.length - 1 && (
              <svg width="54" height="24" viewBox="0 0 54 24" aria-hidden className="shrink-0">
                <line x1="0" y1="12" x2="40" y2="12" stroke={stroke} strokeWidth="2" />
                <path d="M40 6l10 6-10 6" fill="none" stroke={stroke} strokeWidth="2" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#9aa3ad]">
        {verified ? "Verified relationship" : "Possible relationship"} · {edge}
        {violated ? " · confirmed disagreement" : ""}
      </p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-[#12141a] p-4">
        <p className="text-sm text-[#9aa3ad]">{current.event}</p>
        <p className="mt-1 text-lg font-semibold text-white">{current.label}</p>
        <p className="mt-1 text-sm text-[#c5ced6]">{current.verdict}</p>
        <Link href={`/market/${encodeURIComponent(current.symbol)}`} className="mt-3 inline-block text-sm font-medium text-white underline decoration-white/30 underline-offset-4">
          Understand this market
        </Link>
      </div>
    </div>
  );
}
