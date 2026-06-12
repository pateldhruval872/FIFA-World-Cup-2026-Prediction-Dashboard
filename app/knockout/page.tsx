import Link from "next/link";
import { getSimulation } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { pct } from "@/lib/format";
import { ChampionOdds } from "@/components/ChampionOdds";
import { AdvancementTable } from "@/components/AdvancementTable";
import type { SimulationResults } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnockoutPage() {
  const [sim, teams] = await Promise.all([
    getSimulation("FULL"),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);
  const teamIds: Record<string, string> = Object.fromEntries(teams.map((t) => [t.name, t.id]));

  if (!sim) {
    return (
      <div className="card p-6 text-center text-ink-500">
        No simulation yet. Run <code className="rounded bg-ink-100 px-1">python3 ml/simulate.py</code>.
      </div>
    );
  }

  const results: SimulationResults = JSON.parse(sim.results);
  const ranked = results.teams; // already sorted by pChampion
  const favourite = ranked[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Knockout &amp; Champion Odds</h1>
          <p className="mt-1 text-sm text-ink-500">
            {results.iterations.toLocaleString()} full-tournament simulations (seed {results.seed}).
            Group stage → best-thirds → 32-team bracket → final.
          </p>
        </div>
        <Link href="/simulator" className="text-sm font-medium text-pitch-700 hover:underline">
          ← Group standings
        </Link>
      </div>

      <section className="card bg-gradient-to-br from-pitch-900 to-pitch-700 p-6 text-white">
        <div className="text-sm text-pitch-50/80">Title favourite</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-3xl font-bold">{favourite.team}</span>
          <span className="text-2xl font-semibold">{pct(favourite.pChampion, 1)}</span>
        </div>
        <div className="mt-1 text-sm text-pitch-50/80">
          Reaches the final {pct(favourite.pFinal, 1)} of the time · Elo {favourite.elo.toFixed(0)}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Title odds — top 16</h2>
          <ChampionOdds teams={ranked.slice(0, 16)} teamIds={teamIds} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Road through the rounds — top 16</h2>
          <AdvancementTable teams={ranked.slice(0, 16)} teamIds={teamIds} />
        </div>
      </div>

      <p className="text-[11px] text-ink-400">
        Bracket uses a strength-based seeding (group winners, then runners-up, then the eight
        best third-placed teams by Elo), not FIFA&apos;s exact best-third slot table. Champion
        odds are dominated by team strength and are robust to that simplification. Knockout ties
        are decided by sampled scorelines, with a strength-weighted shoot-out on a draw.
      </p>
    </div>
  );
}
