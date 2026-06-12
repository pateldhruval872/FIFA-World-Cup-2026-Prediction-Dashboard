import { NextResponse } from "next/server";
import { getActiveModel, getDataFreshness } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const [model, freshness] = await Promise.all([getActiveModel(), getDataFreshness()]);
  if (!model) return NextResponse.json({ error: "no active model" }, { status: 404 });
  return NextResponse.json({
    version: model.version,
    algorithm: model.algorithm,
    trainedAt: model.trainedAt,
    trainDataHash: model.trainDataHash,
    metrics: model.metrics ? JSON.parse(model.metrics) : null,
    lastIngest: freshness.lastIngest,
  });
}
