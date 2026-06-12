import { confidenceLabel } from "@/lib/format";

// Small badge reflecting how decisive a prediction is (low entropy => high).
export function ModelConfidenceBadge({ confidence }: { confidence: number }) {
  const { label, tone } = confidenceLabel(confidence);
  return (
    <span className={`chip ${tone}`} title={`Confidence score ${confidence.toFixed(2)} (0 = toss-up, 1 = certain)`}>
      {label} confidence
    </span>
  );
}
