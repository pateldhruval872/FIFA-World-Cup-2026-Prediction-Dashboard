import { getVenues } from "@/lib/queries";
import { VenueImpactCard } from "@/components/VenueImpactCard";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const venues = await getVenues();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Host Venues</h1>
        <p className="mt-1 text-sm text-ink-500">
          16 stadiums across the USA, Canada and Mexico, sorted by altitude. Altitude
          and travel feed the prediction context.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((v) => (
          <VenueImpactCard key={v.id} id={v.id} name={v.name} city={v.city} country={v.country}
            altitude={v.altitude} capacity={v.capacity} hasRoof={v.hasRoof} surface={v.surface} compact />
        ))}
      </div>
    </div>
  );
}
