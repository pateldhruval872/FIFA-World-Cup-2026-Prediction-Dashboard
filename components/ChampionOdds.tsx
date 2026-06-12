import Link from "next/link";
import { pct } from "@/lib/format";
import type { SimTeam } from "@/lib/types";

// Title-odds leaderboard as a horizontal bar list.
export function ChampionOdds({ teams, teamIds }: { teams: SimTeam[]; teamIds: Record<string, string> }) {
  const max = Math.max(...teams.map((t) => t.pChampion), 0.0001);
  return (
    <div className="space-y-1.5">
      {teams.map((t, i) => (
        <div key={t.team} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-right text-xs text-ink-400">{i + 1}</span>
          <span className="w-32 shrink-0 truncate text-sm">
            {teamIds[t.team] ? (
              <Link href={`/teams/${teamIds[t.team]}`} className="hover:underline">{t.team}</Link>
            ) : t.team}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-ink-100">
            <div className="h-full rounded bg-pitch-500" style={{ width: `${(t.pChampion / max) * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums">{pct(t.pChampion, 1)}</span>
        </div>
      ))}
    </div>
  );
}
