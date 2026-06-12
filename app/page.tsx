import Link from "next/link";
import { prisma } from "@/lib/db";
import { getFixturesWithPredictions, getTournament, getActiveModel } from "@/lib/queries";
import { MatchCard } from "@/components/MatchCard";
import { pct, dateLabel } from "@/lib/format";
import type { ModelMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

function pickPrediction<P extends { modelVersionId: string }>(
  m: { predictions: P[] }, activeId?: string,
): P | null {
  return m.predictions.find((p) => p.modelVersionId === activeId) ?? m.predictions[0] ?? null;
}

export default async function HomePage() {
  const [tournament, model, matches, topTeams] = await Promise.all([
    getTournament(),
    getActiveModel(),
    getFixturesWithPredictions("GROUP"),
    prisma.team.findMany({
      include: { rankings: { orderBy: { date: "desc" }, take: 1 }, group: true },
    }),
  ]);

  const metrics: ModelMetrics | null = model?.metrics ? JSON.parse(model.metrics) : null;

  const contenders = topTeams
    .map((t) => ({ ...t, elo: t.rankings[0]?.elo ?? 0 }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 8);

  const withPred = matches
    .map((m) => ({ m, p: pickPrediction(m, model?.id) }))
    .filter((x) => x.p);

  const upcoming = withPred.slice(0, 6);
  // Biggest toss-ups: smallest gap between most- and least-likely outcome.
  const upsets = [...withPred]
    .sort((a, b) => {
      const sa = Math.max(a.p!.pHome, a.p!.pDraw, a.p!.pAway) - Math.min(a.p!.pHome, a.p!.pAway);
      const sb = Math.max(b.p!.pHome, b.p!.pDraw, b.p!.pAway) - Math.min(b.p!.pHome, b.p!.pAway);
      return sa - sb;
    })
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="card bg-gradient-to-br from-pitch-900 to-pitch-700 p-6 text-white">
        <h1 className="text-2xl font-bold">{tournament?.name ?? "FIFA World Cup 2026"}</h1>
        <p className="mt-1 text-pitch-50/80">{tournament?.format}</p>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <Stat label="Teams" value="48" />
          <Stat label="Matches" value="104" />
          <Stat label="Host venues" value="16" />
          {metrics && <Stat label="Backtest accuracy" value={pct(metrics.accuracy)} />}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Upcoming matches</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map(({ m, p }) => (
              <MatchCard key={m.id} id={m.id} stage={m.stage} kickoff={m.kickoff}
                venueName={m.venue.name} city={m.venue.city}
                homeTeam={m.homeTeam} awayTeam={m.awayTeam}
                groupLabel={m.group?.label} prediction={p} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="mb-3 text-lg font-semibold">Top contenders</h2>
            <ol className="space-y-1.5 text-sm">
              {contenders.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between">
                  <Link href={`/teams/${t.id}`} className="hover:underline">
                    <span className="mr-2 text-ink-400">{i + 1}.</span>{t.name}
                  </Link>
                  <span className="tabular-nums text-ink-600">{Math.round(t.elo)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-ink-400">Ranked by computed Elo rating.</p>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-lg font-semibold">Closest calls</h2>
            <div className="space-y-2">
              {upsets.map(({ m, p }) => (
                <Link key={m.id} href={`/matches/${m.id}`}
                  className="block rounded-lg border border-ink-100 p-2 text-sm hover:bg-ink-50">
                  <div className="flex justify-between">
                    <span>{m.homeTeam?.name} v {m.awayTeam?.name}</span>
                  </div>
                  <div className="text-xs text-ink-500">
                    {pct(p!.pHome)} / {pct(p!.pDraw)} / {pct(p!.pAway)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="text-sm text-ink-500">
        <Link href="/simulator" className="font-medium text-pitch-700 hover:underline">
          Open the Group Simulator →
        </Link>{" "}
        for projected standings and qualification probabilities.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-pitch-50/70">{label}</div>
    </div>
  );
}
