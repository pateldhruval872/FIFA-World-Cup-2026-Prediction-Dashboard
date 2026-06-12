import { getActiveModel } from "@/lib/queries";
import { dateLabel, pct } from "@/lib/format";
import type { ModelMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ModelLabPage() {
  const model = await getActiveModel();
  const metrics: ModelMetrics | null = model?.metrics ? JSON.parse(model.metrics) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Model Lab</h1>
        <p className="mt-1 text-sm text-ink-500">
          Transparency on how predictions are made, how accurate they are, and
          where they fall short.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Active model</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Item label="Version" value={model?.version ?? "—"} />
          <Item label="Algorithm" value={model?.algorithm ?? "—"} />
          <Item label="Trained" value={model ? dateLabel(model.trainedAt) : "—"} />
          <Item label="Data hash" value={model?.trainDataHash ?? "—"} mono />
        </dl>
      </div>

      {metrics && (
        <div className="card p-5">
          <h2 className="mb-1 font-semibold">Backtest performance</h2>
          <p className="mb-4 text-xs text-ink-500">
            Strict temporal hold-out on {metrics.testMatches.toLocaleString()} post-cutoff
            international matches. Lower log-loss / Brier / RPS is better; the model
            must beat the no-skill baseline.
          </p>
          <div className="overflow-hidden rounded-lg border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Metric</th>
                  <th className="px-4 py-2 text-right font-medium">Model</th>
                  <th className="px-4 py-2 text-right font-medium">Baseline</th>
                </tr>
              </thead>
              <tbody>
                <Row name="Log-loss ↓" model={metrics.logloss} base={metrics.baselineLogloss} better="low" />
                <Row name="Accuracy ↑" model={metrics.accuracy} base={metrics.baselineAccuracy} better="high" isPct />
                <MetricRow name="Brier score ↓" value={metrics.brier} />
                <MetricRow name="Ranked Probability Score ↓" value={metrics.rps} />
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">How it works</h2>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-ink-600">
          <li>World-Football Elo ratings computed over ~150 years of international results (leakage-free, chronological).</li>
          <li>An Elo-conditioned Poisson model maps the rating difference to expected goals for each side.</li>
          <li>An independent-Poisson scoreline matrix yields win/draw/loss probabilities and the likeliest scores.</li>
          <li>Group standings come from {(5000).toLocaleString()} seeded Monte Carlo simulations.</li>
        </ol>
      </div>

      <div className="card border-amber-300 bg-amber-50 p-5">
        <h2 className="mb-3 font-semibold text-amber-900">Known limitations</h2>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-amber-900/90">
          <li>No squad, injury, or player-availability data yet — late changes are not reflected.</li>
          <li>The expanded 48-team format has little historical precedent; novel matchups carry extra uncertainty.</li>
          <li>Travel, rest-day and altitude effects are not yet in the model (shown as context only).</li>
          <li>Independent Poisson slightly under-models draws; calibration is on the roadmap.</li>
          <li>Single matches are inherently high-variance — treat every probability as a distribution, not a verdict.</li>
        </ul>
      </div>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className={`font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function Row({ name, model, base, better, isPct }:
  { name: string; model: number; base: number; better: "low" | "high"; isPct?: boolean }) {
  const win = better === "low" ? model < base : model > base;
  const fmt = (v: number) => (isPct ? pct(v) : v.toFixed(4));
  return (
    <tr className="border-t border-ink-100">
      <td className="px-4 py-2">{name}</td>
      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${win ? "text-pitch-700" : ""}`}>{fmt(model)}</td>
      <td className="px-4 py-2 text-right tabular-nums text-ink-500">{fmt(base)}</td>
    </tr>
  );
}

function MetricRow({ name, value }: { name: string; value: number }) {
  return (
    <tr className="border-t border-ink-100">
      <td className="px-4 py-2">{name}</td>
      <td className="px-4 py-2 text-right font-semibold tabular-nums">{value.toFixed(4)}</td>
      <td className="px-4 py-2 text-right text-ink-300">—</td>
    </tr>
  );
}
