import Link from "next/link";
import { getSimulation } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { GroupTable, type GroupRow } from "@/components/GroupTable";
import type { SimulationResults } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const [sim, teams] = await Promise.all([
    getSimulation("FULL"),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);
  const teamIds: Record<string, string> = Object.fromEntries(teams.map((t) => [t.name, t.id]));

  if (!sim) {
    return <Empty />;
  }
  const results: SimulationResults = JSON.parse(sim.results);
  const byTeam = new Map(results.teams.map((t) => [t.team, t]));

  const tables = Object.entries(results.groups).map(([label, teamNames]) => {
    const rows: GroupRow[] = teamNames
      .map((name) => byTeam.get(name)!)
      .filter(Boolean)
      .map((t) => ({ team: t.team, expPoints: t.expPoints, expGoalDiff: t.expGoalDiff, pTop2: t.pTop2 }));
    return { label, rows };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Group Stage Simulator</h1>
          <p className="mt-1 text-sm text-ink-500">
            {results.iterations.toLocaleString()} Monte Carlo tournaments (seed {results.seed},
            reproducible). Scorelines sampled from the model&apos;s Poisson rates.
          </p>
        </div>
        <Link href="/knockout" className="text-sm font-medium text-pitch-700 hover:underline">
          Knockout &amp; champion odds →
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <GroupTable key={t.label} label={t.label} rows={t.rows} teamIds={teamIds} />
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="card p-6 text-center text-ink-500">
      No simulation has been run yet. Run <code className="rounded bg-ink-100 px-1">python3 ml/simulate.py</code> to
      generate projected standings.
    </div>
  );
}
