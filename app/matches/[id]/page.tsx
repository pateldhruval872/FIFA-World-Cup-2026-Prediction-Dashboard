import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch } from "@/lib/queries";
import { kickoffLabel, stageLabel, pct } from "@/lib/format";
import { ProbabilityCard } from "@/components/ProbabilityCard";
import { ModelConfidenceBadge } from "@/components/ModelConfidenceBadge";
import { ScorelineChart } from "@/components/ScorelineChart";
import { KeyFactors } from "@/components/KeyFactors";
import type { FeatureSnapshot, KeyFactor, ScoreLine } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: { id: string } }) {
  const match = await getMatch(params.id);
  if (!match) notFound();

  const pred = match.predictions[0] ?? null;
  const home = match.homeTeam?.name ?? "TBD";
  const away = match.awayTeam?.name ?? "TBD";
  const played = match.status === "PLAYED" && match.homeScore != null && match.awayScore != null;

  const features: FeatureSnapshot | null = pred ? JSON.parse(pred.featuresSnapshot) : null;
  const factors: KeyFactor[] = pred ? JSON.parse(pred.keyFactors) : [];
  const scorelines: ScoreLine[] = pred ? JSON.parse(pred.scorelineDist) : [];

  return (
    <div className="space-y-6">
      <Link href="/matches" className="text-sm text-ink-500 hover:underline">← All matches</Link>

      <div className="card p-6">
        <div className="mb-1 text-sm text-ink-400">
          {stageLabel(match.stage)}{match.group ? ` · Group ${match.group.label}` : ""} ·{" "}
          {played ? "Final result" : kickoffLabel(match.kickoff)}
        </div>
        <div className="flex items-center justify-between text-2xl font-bold">
          <Link href={match.homeTeam ? `/teams/${match.homeTeam.id}` : "#"} className="hover:underline">{home}</Link>
          {played ? (
            <span className="rounded-lg bg-pitch-900 px-3 py-1 text-white">
              {match.homeScore} – {match.awayScore}
            </span>
          ) : (
            <span className="text-base font-normal text-ink-400">vs</span>
          )}
          <Link href={match.awayTeam ? `/teams/${match.awayTeam.id}` : "#"} className="hover:underline">{away}</Link>
        </div>
        <div className="mt-1 text-center text-sm text-ink-500">
          {match.venue.name}, {match.venue.city} · altitude {match.venue.altitude} m
          {match.venue.altitude >= 1500 ? " (high-altitude venue)" : ""}
        </div>
      </div>

      {!pred ? (
        <div className="card p-6 text-center text-ink-500">
          Participants for this match are decided by earlier results. A prediction
          will appear once both teams are known (via the knockout simulator).
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Match result probability</h2>
                <ModelConfidenceBadge confidence={pred.confidence} />
              </div>
              <ProbabilityCard pHome={pred.pHome} pDraw={pred.pDraw} pAway={pred.pAway}
                homeLabel={home} awayLabel={away} />
              <div className="mt-5 grid grid-cols-2 gap-4 text-center">
                <div className="rounded-lg bg-ink-50 p-3">
                  <div className="text-2xl font-bold">{pred.expGoalsHome.toFixed(1)} – {pred.expGoalsAway.toFixed(1)}</div>
                  <div className="text-xs text-ink-500">Expected goals</div>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <div className="text-2xl font-bold">{scorelines[0]?.score ?? "—"}</div>
                  <div className="text-xs text-ink-500">Most likely scoreline ({pct(scorelines[0]?.p ?? 0)})</div>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-3 font-semibold">Most likely scorelines</h2>
              <ScorelineChart scorelines={scorelines} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">Why this prediction</h2>
              <KeyFactors factors={factors} />
            </div>

            {features && (
              <div className="card p-5">
                <h2 className="mb-3 font-semibold">Team comparison</h2>
                <CompareRow label="Elo rating" home={features.homeElo.toFixed(0)} away={features.awayElo.toFixed(0)} />
                <CompareRow label="Goals/game (last 12)"
                  home={features.homeForm?.gf?.toFixed(1) ?? "—"} away={features.awayForm?.gf?.toFixed(1) ?? "—"} />
                <CompareRow label="Conceded/game (last 12)"
                  home={features.homeForm?.ga?.toFixed(1) ?? "—"} away={features.awayForm?.ga?.toFixed(1) ?? "—"} />
                <CompareRow label="Attack strength"
                  home={features.homeForm?.attack?.toFixed(2) ?? "—"} away={features.awayForm?.attack?.toFixed(2) ?? "—"} />
                <CompareRow label="Defense strength"
                  home={features.homeForm?.defense?.toFixed(2) ?? "—"} away={features.awayForm?.defense?.toFixed(2) ?? "—"} />
                <p className="mt-3 text-[11px] text-ink-400">
                  The model output is driven by the Elo difference and venue
                  neutrality. Form metrics are shown for context.
                </p>
              </div>
            )}
          </div>

          {features?.homeContext && features.awayContext && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">Venue &amp; travel context</h2>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div className="rounded-lg bg-ink-50 p-3">
                  <div className="text-xs text-ink-400">Altitude</div>
                  <div className="font-medium">{features.venueAltitude?.toLocaleString()} m</div>
                  {(features.homeContext.altitudePenalty > 0 || features.awayContext.altitudePenalty > 0) && (
                    <div className="mt-1 text-[11px] text-amber-700">
                      −{Math.round(Math.max(features.homeContext.altitudePenalty, features.awayContext.altitudePenalty) * 100)}%
                      goals for the less-acclimatised side
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <div className="text-xs text-ink-400">Travel from home base</div>
                  <div className="font-medium">
                    {home}: {features.homeContext.travelKm?.toLocaleString() ?? "—"} km
                  </div>
                  <div className="font-medium">
                    {away}: {features.awayContext.travelKm?.toLocaleString() ?? "—"} km
                  </div>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <div className="text-xs text-ink-400">Squad availability</div>
                  <div className="font-medium">
                    {(features.homeUnavailableImpact ?? 0) > 0
                      ? `${home}: −${features.homeUnavailableImpact} Elo` : `${home}: full strength`}
                  </div>
                  <div className="font-medium">
                    {(features.awayUnavailableImpact ?? 0) > 0
                      ? `${away}: −${features.awayUnavailableImpact} Elo` : `${away}: full strength`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CompareRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0">
      <span className="w-16 text-right font-semibold tabular-nums text-pitch-700">{home}</span>
      <span className="flex-1 text-center text-xs text-ink-500">{label}</span>
      <span className="w-16 font-semibold tabular-nums text-blue-600">{away}</span>
    </div>
  );
}
