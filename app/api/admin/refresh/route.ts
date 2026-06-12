import { NextResponse } from "next/server";
import { promisify } from "util";
import { execFile } from "child_process";

const run = promisify(execFile);

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Admin-only (enforced by middleware): ingest any new results, retrain, and
// re-simulate. Runs the same Python pipeline an operator would run by hand.
export async function POST() {
  const cwd = process.cwd();
  const opts = { cwd, timeout: 240_000, maxBuffer: 1024 * 1024 };
  const scripts = ["ml/ingest/match_results.py", "ml/predict.py", "ml/simulate.py"];
  const steps: { script: string; summary: string }[] = [];
  try {
    for (const script of scripts) {
      const { stdout } = await run("python3", [script], opts);
      const lines = stdout.trim().split("\n");
      steps.push({ script, summary: lines[lines.length - 1] ?? "done" });
    }
    return NextResponse.json({ status: "ok", steps });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: msg, steps }, { status: 500 });
  }
}
