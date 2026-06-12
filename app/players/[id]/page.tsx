import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const player = await getPlayer(params.id);
  if (!player) notFound();

  const impact = player.metrics.find((m) => m.metricType === "impact")?.value ?? null;
  const available = player.squadEntries[0]?.isAvailable ?? true;

  return (
    <div className="space-y-6">
      {player.nationalTeam && (
        <Link href={`/teams/${player.nationalTeam.id}`} className="text-sm text-ink-500 hover:underline">
          ← {player.nationalTeam.name}
        </Link>
      )}

      <div className="card p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{player.name}</h1>
          {!available && <span className="chip bg-red-500/15 text-red-700">Unavailable</span>}
        </div>
        <div className="mt-1 text-sm text-ink-500">
          {player.position}{player.club ? ` · ${player.club}` : ""}
          {player.nationalTeam ? ` · ${player.nationalTeam.name}` : ""}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Elo impact" value={impact != null ? `+${impact}` : "—"} />
          <Stat label="Availability" value={available ? "Available" : "Out"} />
          <Stat label="Position" value={player.position ?? "—"} />
        </div>
        {impact != null && (
          <p className="mt-4 text-xs text-ink-500">
            If marked unavailable, {player.nationalTeam?.name ?? "the team"}&apos;s effective
            Elo drops by {impact} points, lowering its win probabilities across the tournament.
          </p>
        )}
      </div>

      <p className="text-[11px] text-ink-400">
        Squad data is illustrative sample data demonstrating the player-impact mechanism.
        Replace with official 26-man squads via the data pipeline once released.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}
