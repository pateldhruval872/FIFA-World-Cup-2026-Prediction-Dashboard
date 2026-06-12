import { dateLabel } from "@/lib/format";

type Props = { lastIngest: Date | null; modelVersion: string | null };

// Persistent honesty strip: when were predictions last computed, and by which model.
export function DataFreshnessBanner({ lastIngest, modelVersion }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink-200 bg-white px-4 py-2 text-xs text-ink-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-pitch-500" />
        Predictions current as of{" "}
        <strong className="text-ink-800">
          {lastIngest ? dateLabel(lastIngest) : "—"}
        </strong>
      </span>
      <span>
        Model: <strong className="text-ink-800">{modelVersion ?? "none"}</strong>
      </span>
      <span className="text-ink-400">
        For analytics &amp; entertainment — not betting advice.
      </span>
    </div>
  );
}
