/**
 * Seed the database from canonical JSON in data/seed/.
 * Run `npm run seed:build` first to (re)generate that JSON from the dataset.
 *
 * Idempotent: clears prediction/match/group/team/venue rows for the tournament
 * and re-inserts, so it can be run repeatedly during development.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const SEED = join(process.cwd(), "data", "seed");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(SEED, name), "utf-8")) as T;
}

type TournamentSeed = {
  name: string; year: number; hostCountries: string; format: string;
  startDate: string; endDate: string;
};
type VenueSeed = {
  city: string; name: string; country: string; lat: number; lng: number;
  altitude: number; capacity?: number; hasRoof?: boolean; surface?: string;
};
type TeamSeed = {
  name: string; fifaCode?: string; confederation?: string; isHost: boolean;
  homeLat?: number; homeLng?: number; homeAltitude?: number; group: string;
};
type GroupSeed = { label: string; teams: string[] };
type FixtureSeed = {
  matchNo: number; stage: string; group: string | null;
  homeTeam: string | null; awayTeam: string | null; city: string;
  kickoff: string; neutral: boolean; slot?: string;
};

async function main() {
  const tournament = load<TournamentSeed>("tournament.json");
  const venues = load<VenueSeed[]>("venues.json");
  const teams = load<TeamSeed[]>("teams.json");
  const groups = load<GroupSeed[]>("groups.json");
  const fixtures = load<FixtureSeed[]>("fixtures.json");

  console.log("Clearing existing data…");
  await prisma.prediction.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.match.deleteMany();
  await prisma.teamForm.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.squadEntry.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.group.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.tournament.deleteMany();

  console.log("Inserting tournament…");
  const t = await prisma.tournament.create({
    data: {
      name: tournament.name,
      year: tournament.year,
      hostCountries: tournament.hostCountries,
      format: tournament.format,
      startDate: new Date(tournament.startDate),
      endDate: new Date(tournament.endDate),
    },
  });

  console.log("Inserting venues…");
  const venueByCity = new Map<string, string>();
  for (const v of venues) {
    const row = await prisma.venue.create({
      data: {
        name: v.name, city: v.city, country: v.country, lat: v.lat, lng: v.lng,
        altitude: v.altitude, capacity: v.capacity ?? null,
        hasRoof: v.hasRoof ?? false, surface: v.surface ?? null,
      },
    });
    venueByCity.set(v.city, row.id);
  }

  console.log("Inserting groups…");
  const groupByLabel = new Map<string, string>();
  for (const g of groups) {
    const row = await prisma.group.create({
      data: { label: g.label, tournamentId: t.id },
    });
    groupByLabel.set(g.label, row.id);
  }

  console.log("Inserting teams…");
  const teamByName = new Map<string, string>();
  for (const tm of teams) {
    const row = await prisma.team.create({
      data: {
        name: tm.name, fifaCode: tm.fifaCode ?? null,
        confederation: tm.confederation ?? null, isHost: tm.isHost,
        homeLat: tm.homeLat ?? null, homeLng: tm.homeLng ?? null,
        homeAltitude: tm.homeAltitude ?? null,
        tournamentId: t.id, groupId: groupByLabel.get(tm.group) ?? null,
      },
    });
    teamByName.set(tm.name, row.id);
  }

  console.log("Inserting fixtures…");
  for (const f of fixtures) {
    await prisma.match.create({
      data: {
        tournamentId: t.id, stage: f.stage, matchNo: f.matchNo,
        groupId: f.group ? groupByLabel.get(f.group) ?? null : null,
        homeTeamId: f.homeTeam ? teamByName.get(f.homeTeam) ?? null : null,
        awayTeamId: f.awayTeam ? teamByName.get(f.awayTeam) ?? null : null,
        venueId: venueByCity.get(f.city)!,
        kickoff: new Date(f.kickoff), neutral: f.neutral, status: "SCHEDULED",
      },
    });
  }

  console.log(
    `Seed complete: ${venues.length} venues, ${groups.length} groups, ` +
    `${teams.length} teams, ${fixtures.length} fixtures.`
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
