import { pct } from "@/lib/format";

type Props = {
  pHome: number;
  pDraw: number;
  pAway: number;
  homeLabel: string;
  awayLabel: string;
  compact?: boolean;
};

// Win/Draw/Loss split bar. Always shown as a distribution, never a single result.
export function ProbabilityCard({ pHome, pDraw, pAway, homeLabel, awayLabel, compact }: Props) {
  const segs = [
    { p: pHome, color: "bg-pitch-500", label: homeLabel },
    { p: pDraw, color: "bg-ink-400", label: "Draw" },
    { p: pAway, color: "bg-blue-500", label: awayLabel },
  ];
  return (
    <div>
      <div className={`flex w-full overflow-hidden rounded-lg ${compact ? "h-2.5" : "h-6"}`}>
        {segs.map((s, i) => (
          <div
            key={i}
            className={`${s.color} ${i > 0 ? "border-l border-white" : ""}`}
            style={{ width: `${Math.max(s.p * 100, 0)}%` }}
            title={`${s.label}: ${pct(s.p, 1)}`}
          />
        ))}
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between text-sm">
          <span className="font-semibold text-pitch-700">{homeLabel} {pct(pHome)}</span>
          <span className="text-ink-600">Draw {pct(pDraw)}</span>
          <span className="font-semibold text-blue-600">{awayLabel} {pct(pAway)}</span>
        </div>
      )}
    </div>
  );
}
