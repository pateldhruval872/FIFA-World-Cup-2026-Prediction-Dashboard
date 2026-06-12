import Link from "next/link";
import { getFixturesWithPredictions, getActiveModel } from "@/lib/queries";
import { MatchCard } from "@/components/MatchCard";
import { dateLabel, stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "", label: "All" },
  { key: "GROUP", label: "Group" },
  { key: "R32", label: "R32" },
  { key: "R16", label: "R16" },
  { key: "QF", label: "QF" },
  { key: "SF", label: "SF" },
  { key: "FINAL", label: "Final" },
];

export default async function MatchesPage({ searchParams }: { searchParams: { stage?: string } }) {
  const stage = searchParams.stage || undefined;
  const [matches, model] = await Promise.all([
    getFixturesWithPredictions(stage),
    getActiveModel(),
  ]);

  // group fixtures by calendar day
  const byDay = new Map<string, typeof matches>();
  for (const m of matches) {
    const day = dateLabel(m.kickoff);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(m);
  }

  const playedCount = matches.filter((m) => m.status === "PLAYED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Matches</h1>
        <p className="mt-1 text-sm text-ink-500">
          {matches.length} fixtures{playedCount > 0 ? ` · ${playedCount} played` : ""} ·
          predictions from {model?.version ?? "—"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <Link key={s.key} href={s.key ? `/matches?stage=${s.key}` : "/matches"}
            className={`chip ${(stage ?? "") === s.key ? "bg-pitch-700 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}>
            {s.label}
          </Link>
        ))}
      </div>

      {[...byDay.entries()].map(([day, dayMatches]) => (
        <section key={day}>
          <h2 className="mb-3 text-sm font-semibold text-ink-600">{day}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dayMatches.map((m) => (
              <MatchCard key={m.id} id={m.id} stage={m.stage} kickoff={m.kickoff}
                venueName={m.venue.name} city={m.venue.city}
                homeTeam={m.homeTeam} awayTeam={m.awayTeam}
                groupLabel={m.group?.label} prediction={m.predictions[0] ?? null}
                status={m.status} homeScore={m.homeScore} awayScore={m.awayScore} />
            ))}
          </div>
        </section>
      ))}

      {matches.length === 0 && (
        <p className="text-sm text-ink-500">No matches for this stage.</p>
      )}
    </div>
  );
}
