import { getGroups } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { simulateGroup, matchesFromGroup } from "@/lib/simulate";
import { GroupTable } from "@/components/GroupTable";

export const dynamic = "force-dynamic";

const ITERATIONS = 5000;
const SEED = 2026;

export default async function SimulatorPage() {
  const [groups, teams] = await Promise.all([
    getGroups(),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);
  const teamIds: Record<string, string> = Object.fromEntries(teams.map((t) => [t.name, t.id]));

  const tables = groups.map((g) => {
    const simMatches = matchesFromGroup(g.matches);
    const teamNames = g.teams.map((t) => t.name);
    const rows = simMatches.length
      ? simulateGroup(simMatches, teamNames, ITERATIONS, SEED)
      : teamNames.map((team) => ({ team, expPoints: 0, expGoalDiff: 0, pFirst: 0, pSecond: 0, pTop2: 0 }));
    return { label: g.label, rows };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Group Stage Simulator</h1>
        <p className="mt-1 text-sm text-ink-500">
          {ITERATIONS.toLocaleString()} Monte Carlo simulations per group (seed {SEED},
          reproducible). Scorelines sampled from the model&apos;s Poisson rates.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <GroupTable key={t.label} label={t.label} rows={t.rows} teamIds={teamIds} />
        ))}
      </div>
    </div>
  );
}
