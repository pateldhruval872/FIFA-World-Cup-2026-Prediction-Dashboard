import Link from "next/link";
import { pct } from "@/lib/format";
import type { SimTeam } from "@/lib/types";

const COLS: { key: keyof SimTeam; label: string }[] = [
  { key: "pKO", label: "Knockout" },
  { key: "pR16", label: "R16" },
  { key: "pQF", label: "Quarter" },
  { key: "pSF", label: "Semi" },
  { key: "pFinal", label: "Final" },
  { key: "pChampion", label: "Champion" },
];

// Per-team probability of reaching each knockout round. Heat-shaded cells.
export function AdvancementTable({ teams, teamIds }: { teams: SimTeam[]; teamIds: Record<string, string> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-ink-400">
            <th className="px-3 py-2 text-left font-medium">Team</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-3 py-2 text-right font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.team} className="border-t border-ink-100">
              <td className="px-3 py-1.5 font-medium">
                {teamIds[t.team] ? (
                  <Link href={`/teams/${teamIds[t.team]}`} className="hover:underline">{t.team}</Link>
                ) : t.team}
              </td>
              {COLS.map((c) => {
                const v = t[c.key] as number;
                return (
                  <td key={c.key} className="px-3 py-1.5 text-right tabular-nums"
                    style={{ backgroundColor: `rgba(22,163,74,${Math.min(v, 1) * 0.45})` }}>
                    {pct(v, v < 0.1 ? 1 : 0)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
