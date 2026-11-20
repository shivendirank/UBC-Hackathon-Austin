/** Full-screen ambient: frosted crypto prediction chips drifting behind the UI. */
const CHIPS = [
  { label: "BTC", sub: "$95k+", x: 7, y: 12, size: 118, rot: -16, delay: 0, dur: 22 },
  { label: "72¢", sub: "SOL ≥$180", x: 82, y: 9, size: 102, rot: 12, delay: 2.2, dur: 26 },
  { label: "ETH", sub: "$3.5k+", x: 68, y: 56, size: 110, rot: -10, delay: 1.0, dur: 24 },
  { label: "41¢", sub: "XRP ≥$2", x: 14, y: 58, size: 94, rot: 18, delay: 3.0, dur: 28 },
  { label: "88¢", sub: "BTC Nov", x: 88, y: 40, size: 108, rot: -22, delay: 0.7, dur: 20 },
  { label: "19¢", sub: "ETH Dec", x: 40, y: 80, size: 86, rot: 8, delay: 4.0, dur: 30 },
  { label: "SOL", sub: "≥$200", x: 3, y: 38, size: 98, rot: 6, delay: 1.6, dur: 25 },
  { label: "55¢", sub: "BTC $100k", x: 50, y: 20, size: 90, rot: -14, delay: 2.8, dur: 27 },
  { label: "DOGE", sub: "≥$0.40", x: 28, y: 6, size: 78, rot: 24, delay: 4.8, dur: 23 },
  { label: "63¢", sub: "ETH ≥$4k", x: 72, y: 78, size: 100, rot: -6, delay: 3.4, dur: 29 },
  { label: "9¢", sub: "SOL crash", x: 92, y: 68, size: 74, rot: 16, delay: 2.0, dur: 21 },
  { label: "XRP", sub: "≥$3", x: 22, y: 78, size: 82, rot: -20, delay: 5.2, dur: 31 },
] as const;

export function OddsGlassField() {
  return (
    <div className="odds-field" aria-hidden>
      <div className="odds-field__veil" />
      {CHIPS.map((chip, i) => (
        <div
          key={`${chip.label}-${chip.sub}-${i}`}
          className="odds-chip"
          style={{
            left: `${chip.x}%`,
            top: `${chip.y}%`,
            width: chip.size,
            height: chip.size,
            ["--chip-rot" as string]: `${chip.rot}deg`,
            ["--chip-delay" as string]: `${chip.delay}s`,
            ["--chip-dur" as string]: `${chip.dur}s`,
          }}
        >
          <div className="odds-chip__face">
            <span className="odds-chip__label">{chip.label}</span>
            <span className="odds-chip__sub">{chip.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
