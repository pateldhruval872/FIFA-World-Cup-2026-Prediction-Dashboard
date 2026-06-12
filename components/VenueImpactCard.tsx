import Link from "next/link";

type Props = {
  id?: string;
  name: string;
  city: string;
  country: string;
  altitude: number;
  capacity?: number | null;
  hasRoof?: boolean;
  surface?: string | null;
  compact?: boolean;
};

// Stadium facts + environmental factors that feed the prediction context.
export function VenueImpactCard(v: Props) {
  const highAltitude = v.altitude >= 1500;
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{v.name}</div>
          <div className="text-sm text-ink-500">{v.city}, {v.country}</div>
        </div>
        {highAltitude && (
          <span className="chip bg-amber-500/15 text-amber-700">High altitude</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Fact label="Altitude" value={`${v.altitude.toLocaleString()} m`} />
        {v.capacity ? <Fact label="Capacity" value={v.capacity.toLocaleString()} /> : null}
        <Fact label="Roof" value={v.hasRoof ? "Yes" : "Open"} />
        {v.surface ? <Fact label="Surface" value={v.surface} /> : null}
      </div>
      {highAltitude && !v.compact && (
        <p className="mt-3 text-xs text-amber-700">
          Teams based well below this altitude have their expected goals reduced —
          a bounded, acclimatisation-based adjustment in the model.
        </p>
      )}
    </>
  );

  return v.id ? (
    <Link href={`/venues/${v.id}`} className="card block p-4 transition hover:shadow-md">{body}</Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
