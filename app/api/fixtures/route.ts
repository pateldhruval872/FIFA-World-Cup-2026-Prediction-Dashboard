import { NextRequest, NextResponse } from "next/server";
import { getFixturesWithPredictions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage") ?? undefined;
  const matches = await getFixturesWithPredictions(stage);
  return NextResponse.json(
    matches.map((m) => ({
      id: m.id,
      stage: m.stage,
      kickoff: m.kickoff,
      group: m.group?.label ?? null,
      venue: { name: m.venue.name, city: m.venue.city, altitude: m.venue.altitude },
      home: m.homeTeam?.name ?? null,
      away: m.awayTeam?.name ?? null,
      prediction: m.predictions[0]
        ? {
            pHome: m.predictions[0].pHome,
            pDraw: m.predictions[0].pDraw,
            pAway: m.predictions[0].pAway,
            expGoalsHome: m.predictions[0].expGoalsHome,
            expGoalsAway: m.predictions[0].expGoalsAway,
            confidence: m.predictions[0].confidence,
          }
        : null,
    })),
  );
}
