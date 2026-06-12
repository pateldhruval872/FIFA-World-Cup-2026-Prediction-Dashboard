import Link from "next/link";
import { notFound } from "next/navigation";
import { getVenue } from "@/lib/queries";
import { kickoffLabel, stageLabel } from "@/lib/format";
import { VenueImpactCard } from "@/components/VenueImpactCard";

export const dynamic = "force-dynamic";

export default async function VenuePage({ params }: { params: { id: string } }) {
  const venue = await getVenue(params.id);
  if (!venue) notFound();

  return (
    <div className="space-y-6">
      <Link href="/venues" className="text-sm text-ink-500 hover:underline">← All venues</Link>

      <VenueImpactCard
        name={venue.name} city={venue.city} country={venue.country}
        altitude={venue.altitude} capacity={venue.capacity} hasRoof={venue.hasRoof}
        surface={venue.surface}
      />

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Matches at this venue ({venue.matches.length})</h2>
        <div className="space-y-2">
          {venue.matches.map((m) => (
            <Link key={m.id} href={`/matches/${m.id}`}
              className="flex items-center justify-between rounded-lg border border-ink-100 p-3 text-sm hover:bg-ink-50">
              <span className="font-medium">
                {m.homeTeam?.name ?? "TBD"} vs {m.awayTeam?.name ?? "TBD"}
              </span>
              <span className="text-xs text-ink-400">
                {stageLabel(m.stage)}{m.group ? ` · Grp ${m.group.label}` : ""} · {kickoffLabel(m.kickoff)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
