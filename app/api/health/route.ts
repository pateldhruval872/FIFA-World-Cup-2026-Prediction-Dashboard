import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Liveness + readiness: confirms the DB is reachable and reports data freshness.
export async function GET() {
  try {
    const [teams, matches, predictions, model, lastLog] = await Promise.all([
      prisma.team.count(),
      prisma.match.count(),
      prisma.prediction.count(),
      prisma.modelVersion.findFirst({ where: { isActive: true } }),
      prisma.dataSourceLog.findFirst({ orderBy: { runAt: "desc" } }),
    ]);
    const ready = teams > 0 && predictions > 0 && !!model;
    return NextResponse.json(
      {
        status: ready ? "ok" : "degraded",
        db: "up",
        counts: { teams, matches, predictions },
        activeModel: model?.version ?? null,
        lastIngest: lastLog?.runAt ?? null,
        time: new Date().toISOString(),
      },
      { status: ready ? 200 : 503 },
    );
  } catch (e) {
    return NextResponse.json(
      { status: "error", db: "down", error: String(e) },
      { status: 503 },
    );
  }
}
