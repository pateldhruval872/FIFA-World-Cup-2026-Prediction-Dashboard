import type { KeyFactor } from "@/lib/types";
import { impactTone } from "@/lib/format";

// "Why this prediction" — the factors that actually drove the model output.
export function KeyFactors({ factors }: { factors: KeyFactor[] }) {
  return (
    <ul className="space-y-3">
      {factors.map((f, i) => (
        <li key={i} className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink-800">{f.factor}</div>
            <div className="text-xs text-ink-600">{f.detail}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`chip ${impactTone[f.impact] ?? impactTone.Low}`}>
              {f.impactPct != null && f.impactPct !== 0
                ? `${f.impactPct > 0 ? "+" : ""}${f.impactPct} pp`
                : f.impact}
            </span>
            {f.direction !== "Even" && (
              <span className="text-xs font-medium text-ink-600">→ {f.direction}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
