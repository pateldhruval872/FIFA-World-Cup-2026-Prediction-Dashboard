import Link from "next/link";

type Props = {
  id: string;
  name: string;
  position?: string | null;
  club?: string | null;
  impact?: number | null;
  available?: boolean;
};

// A squad player with their estimated Elo impact + availability.
export function PlayerImpactCard({ id, name, position, club, impact, available = true }: Props) {
  return (
    <Link href={`/players/${id}`}
      className="card flex items-center justify-between p-3 transition hover:shadow-md">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {!available && <span className="chip bg-red-500/15 text-red-700">Out</span>}
        </div>
        <div className="text-xs text-ink-500">
          {position}{club ? ` · ${club}` : ""}
        </div>
      </div>
      {impact != null && (
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-pitch-700">+{impact}</div>
          <div className="text-[11px] text-ink-400">Elo impact</div>
        </div>
      )}
    </Link>
  );
}
