import type { ReliabilityBin } from "@/lib/types";

// Reliability diagram: predicted vs observed home-win frequency. Points on the
// dashed diagonal mean perfect calibration (a stated 70% happens ~70% of the time).
export function ReliabilityChart({ bins }: { bins: ReliabilityBin[] }) {
  const W = 320, H = 320, pad = 36;
  const x = (v: number) => pad + v * (W - 2 * pad);
  const y = (v: number) => H - pad - v * (H - 2 * pad);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm">
      {/* axes */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#cbd5e1" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#cbd5e1" />
      {/* perfect-calibration diagonal */}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#94a3b8" strokeDasharray="4 4" />
      {/* model curve */}
      <polyline
        fill="none" stroke="#16a34a" strokeWidth={2}
        points={bins.map((b) => `${x(b.predicted)},${y(b.observed)}`).join(" ")}
      />
      {bins.map((b, i) => (
        <circle key={i} cx={x(b.predicted)} cy={y(b.observed)} r={3.5} fill="#15803d" />
      ))}
      {/* labels */}
      <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-ink-400" fontSize="11">
        Predicted probability
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontSize="11"
        className="fill-ink-400" transform={`rotate(-90 12 ${H / 2})`}>
        Observed frequency
      </text>
    </svg>
  );
}
