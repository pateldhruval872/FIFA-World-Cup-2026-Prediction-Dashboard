import Link from "next/link";
import { kickoffLabel, stageLabel } from "@/lib/format";
import { ProbabilityCard } from "./ProbabilityCard";

type TeamLite = { name: string; fifaCode: string | null } | null;
type Pred = { pHome: number; pDraw: number; pAway: number; expGoalsHome: number; expGoalsAway: number } | null;

type Props = {
  id: string;
  stage: string;
  kickoff: Date;
  venueName: string;
  city: string;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  groupLabel?: string | null;
  prediction: Pred;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

export function MatchCard({ id, stage, kickoff, venueName, city, homeTeam, awayTeam, groupLabel, prediction, status, homeScore, awayScore }: Props) {
  const home = homeTeam?.name ?? "TBD";
  const away = awayTeam?.name ?? "TBD";
  const played = status === "PLAYED" && homeScore != null && awayScore != null;
  return (
    <Link href={`/matches/${id}`} className="card block p-4 transition hover:shadow-md">
      <div className="mb-2 flex items-center justify-between text-xs text-ink-400">
        <span>{stageLabel(stage)}{groupLabel ? ` · Group ${groupLabel}` : ""}</span>
        <span>{played ? <span className="font-medium text-pitch-700">FT</span> : kickoffLabel(kickoff)}</span>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-base font-semibold">{home}</span>
        {played ? (
          <span className="rounded bg-pitch-900 px-2.5 py-0.5 text-sm font-bold text-white">
            {homeScore} – {awayScore}
          </span>
        ) : prediction ? (
          <span className="rounded bg-ink-50 px-2 py-0.5 text-sm font-medium text-ink-600">
            {prediction.expGoalsHome.toFixed(1)} – {prediction.expGoalsAway.toFixed(1)}
          </span>
        ) : (
          <span className="text-xs text-ink-400">vs</span>
        )}
        <span className="text-base font-semibold">{away}</span>
      </div>
      {played ? (
        <div className="text-center text-xs text-ink-400">Final result</div>
      ) : prediction ? (
        <ProbabilityCard
          pHome={prediction.pHome}
          pDraw={prediction.pDraw}
          pAway={prediction.pAway}
          homeLabel={homeTeam?.fifaCode ?? home}
          awayLabel={awayTeam?.fifaCode ?? away}
        />
      ) : (
        <div className="text-center text-xs text-ink-400">
          Participants decided by group results
        </div>
      )}
      <div className="mt-2 text-center text-xs text-ink-400">{venueName}, {city}</div>
    </Link>
  );
}
