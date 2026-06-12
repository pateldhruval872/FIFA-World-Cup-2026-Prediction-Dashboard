import Link from "next/link";
import { pct } from "@/lib/format";
import type { StandingRow } from "@/lib/simulate";

type Props = {
  label: string;
  rows: StandingRow[];
  teamIds: Record<string, string>;
};

// Projected group standings with Monte Carlo qualification probabilities.
export function GroupTable({ label, rows, teamIds }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-200 bg-ink-50 px-4 py-2 text-sm font-semibold">
        Group {label}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-400">
            <th className="px-4 py-2 font-medium">Team</th>
            <th className="px-2 py-2 text-right font-medium">xPts</th>
            <th className="px-2 py-2 text-right font-medium">xGD</th>
            <th className="px-4 py-2 text-right font-medium">Advance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team} className={`border-t border-ink-100 ${i < 2 ? "bg-pitch-50/40" : ""}`}>
              <td className="px-4 py-2">
                {teamIds[r.team] ? (
                  <Link href={`/teams/${teamIds[r.team]}`} className="hover:underline">
                    {r.team}
                  </Link>
                ) : r.team}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{r.expPoints.toFixed(1)}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {r.expGoalDiff > 0 ? "+" : ""}{r.expGoalDiff.toFixed(1)}
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{pct(r.pTop2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-ink-100 px-4 py-1.5 text-[11px] text-ink-400">
        Top 2 (shaded) advance directly. Best-third qualification not modelled here.
      </div>
    </div>
  );
}
