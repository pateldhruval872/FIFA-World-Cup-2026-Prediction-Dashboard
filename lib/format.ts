// Shared formatting + presentation helpers.

export function pct(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`;
}

export function kickoffLabel(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

export function dateLabel(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export type Outcome = "home" | "draw" | "away";

export function favored(pHome: number, pDraw: number, pAway: number): Outcome {
  const m = Math.max(pHome, pDraw, pAway);
  if (m === pHome) return "home";
  if (m === pAway) return "away";
  return "draw";
}

// Confidence band → human label. Mirrors ml/predict.py confidence (0..1).
export function confidenceLabel(c: number): { label: string; tone: string } {
  if (c >= 0.5) return { label: "High", tone: "bg-pitch-500/15 text-pitch-700" };
  if (c >= 0.25) return { label: "Moderate", tone: "bg-amber-500/15 text-amber-700" };
  return { label: "Low / toss-up", tone: "bg-ink-200 text-ink-600" };
}

export const impactTone: Record<string, string> = {
  High: "bg-pitch-500/15 text-pitch-700",
  Medium: "bg-amber-500/15 text-amber-700",
  Low: "bg-ink-200 text-ink-600",
};

export function stageLabel(stage: string): string {
  return {
    GROUP: "Group Stage", R32: "Round of 32", R16: "Round of 16",
    QF: "Quarter-final", SF: "Semi-final", THIRD: "Third place", FINAL: "Final",
  }[stage] ?? stage;
}
