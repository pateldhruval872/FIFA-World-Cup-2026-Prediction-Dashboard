import type { ScoreLine } from "@/lib/types";
import { pct } from "@/lib/format";

// Most-likely scorelines as a horizontal bar list (dependency-free SVG-less).
export function ScorelineChart({ scorelines }: { scorelines: ScoreLine[] }) {
  const max = Math.max(...scorelines.map((s) => s.p), 0.0001);
  return (
    <div className="space-y-2">
      {scorelines.map((s) => (
        <div key={s.score} className="flex items-center gap-3">
          <span className="w-10 shrink-0 font-mono text-sm text-ink-800">{s.score}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-ink-100">
            <div
              className="h-full rounded bg-pitch-500"
              style={{ width: `${(s.p / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs text-ink-600">{pct(s.p, 0)}</span>
        </div>
      ))}
    </div>
  );
}
