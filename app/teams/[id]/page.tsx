import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, getTeamFixtures } from "@/lib/queries";
import { kickoffLabel, stageLabel, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: { id: string } }) {
  const team = await getTeam(params.id);
  if (!team) notFound();
  const fixtures = await getTeamFixtures(params.id);

  const elo = team.rankings[0]?.elo;
  const form = team.forms[0];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-ink-500 hover:underline">← Home</Link>

      <div className="card p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {team.fifaCode && <span className="chip bg-ink-100 text-ink-600">{team.fifaCode}</span>}
          {team.isHost && <span className="chip bg-pitch-500/15 text-pitch-700">Host nation</span>}
        </div>
        <div className="mt-1 text-sm text-ink-500">
          {team.confederation}{team.group ? ` · Group ${team.group.label}` : ""}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Elo rating" value={elo ? Math.round(elo).toString() : "—"} />
          <Stat label="Goals/game" value={form?.goalsForAvg?.toFixed(1) ?? "—"} />
          <Stat label="Conceded/game" value={form?.goalsAgainstAvg?.toFixed(1) ?? "—"} />
          <Stat label="Form (last 5, pts)" value={form?.last5Points?.toString() ?? "—"} />
        </div>
      </div>

      {team.group && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Group {team.group.label}</h2>
          <div className="flex flex-wrap gap-2">
            {team.group.teams.map((t) => (
              <Link key={t.id} href={`/teams/${t.id}`}
                className={`chip ${t.id === team.id ? "bg-pitch-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}>
                {t.name}
              </Link>
            ))}
          </div>
          <Link href="/simulator" className="mt-3 inline-block text-sm text-pitch-700 hover:underline">
            See projected standings →
          </Link>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Fixtures &amp; predictions</h2>
        <div className="space-y-2">
          {fixtures.filter((f) => f.predictions.length > 0).map((f) => {
            const isHome = f.homeTeamId === team.id;
            const opp = isHome ? f.awayTeam : f.homeTeam;
            const p = f.predictions[0];
            const winProb = isHome ? p.pHome : p.pAway;
            return (
              <Link key={f.id} href={`/matches/${f.id}`}
                className="flex items-center justify-between rounded-lg border border-ink-100 p-3 text-sm hover:bg-ink-50">
                <div>
                  <div className="font-medium">
                    {isHome ? "vs" : "@"} {opp?.name ?? "TBD"}
                  </div>
                  <div className="text-xs text-ink-400">
                    {stageLabel(f.stage)} · {kickoffLabel(f.kickoff)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-pitch-700">{pct(winProb)} win</div>
                  <div className="text-xs text-ink-400">
                    xG {isHome ? p.expGoalsHome.toFixed(1) : p.expGoalsAway.toFixed(1)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
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
