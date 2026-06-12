import { NextResponse } from "next/server";
import { getMatch } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await getMatch(params.matchId);
  if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });
  const p = match.predictions[0];
  if (!p) return NextResponse.json({ error: "no prediction" }, { status: 404 });
  return NextResponse.json({
    matchId: match.id,
    home: match.homeTeam?.name ?? null,
    away: match.awayTeam?.name ?? null,
    pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway,
    expGoalsHome: p.expGoalsHome, expGoalsAway: p.expGoalsAway,
    confidence: p.confidence,
    scorelineDist: JSON.parse(p.scorelineDist),
    keyFactors: JSON.parse(p.keyFactors),
    features: JSON.parse(p.featuresSnapshot),
    model: p.modelVersion.version,
  });
}
