import Link from "next/link";

type SquadRow = {
  playerId: string;
  isAvailable: boolean;
  player: {
    name: string;
    position: string | null;
    club: string | null;
    metrics: { value: number }[];
  };
};

const ORDER = ["GK", "DEF", "MID", "FWD"];
const LABELS: Record<string, string> = { GK: "Goalkeeper", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

function group(squad: SquadRow[]) {
  const by: Record<string, SquadRow[]> = {};
  for (const s of squad) {
    const pos = s.player.position ?? "—";
    (by[pos] ??= []).push(s);
  }
  return by;
}

function Side({ team, squad }: { team: string; squad: SquadRow[] }) {
  const by = group(squad);
  const keys = [...ORDER.filter((k) => by[k]), ...Object.keys(by).filter((k) => !ORDER.includes(k))];
  return (
    <div>
      <h3 className="mb-2 font-semibold">{team}</h3>
      {squad.length === 0 ? (
        <p className="text-xs text-ink-400">No confirmed line-up yet.</p>
      ) : (
        <div className="space-y-3">
          {keys.map((pos) => (
            <div key={pos}>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-400">{LABELS[pos] ?? pos}</div>
              <ul className="space-y-1">
                {by[pos].map((s) => (
                  <li key={s.playerId} className="flex items-center justify-between text-sm">
                    <Link href={`/players/${s.playerId}`} className="hover:underline">
                      {s.player.name}
                      {!s.isAvailable && <span className="ml-1 text-[11px] text-red-600">(out)</span>}
                    </Link>
                    <span className="text-xs text-ink-400">{s.player.club ?? ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Side-by-side confirmed line-ups for a match.
export function Lineups({ home, away, homeSquad, awaySquad }: {
  home: string; away: string; homeSquad: SquadRow[]; awaySquad: SquadRow[];
}) {
  if (homeSquad.length === 0 && awaySquad.length === 0) return null;
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">Confirmed line-ups</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <Side team={home} squad={homeSquad} />
        <Side team={away} squad={awaySquad} />
      </div>
    </div>
  );
}
