// Server-side data access used by pages and API routes.
import { prisma } from "./db";

export async function getActiveModel() {
  return prisma.modelVersion.findFirst({ where: { isActive: true } });
}

export async function getTournament() {
  return prisma.tournament.findFirst();
}

export async function getFixturesWithPredictions(stage?: string) {
  return prisma.match.findMany({
    where: stage ? { stage } : undefined,
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: true,
      awayTeam: true,
      venue: true,
      group: true,
      predictions: { include: { modelVersion: true } },
    },
  });
}

export async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      venue: true,
      group: true,
      predictions: { include: { modelVersion: true } },
    },
  });
}

export async function getTeam(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      group: { include: { teams: true } },
      rankings: { orderBy: { date: "desc" }, take: 1 },
      forms: { orderBy: { asOfDate: "desc" }, take: 1 },
    },
  });
}

export async function getTeamFixtures(teamId: string) {
  return prisma.match.findMany({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: true, awayTeam: true, venue: true,
      predictions: true,
    },
  });
}

export async function getGroups() {
  return prisma.group.findMany({
    orderBy: { label: "asc" },
    include: {
      teams: {
        include: {
          rankings: { orderBy: { date: "desc" }, take: 1 },
          forms: { orderBy: { asOfDate: "desc" }, take: 1 },
        },
      },
      matches: {
        include: { homeTeam: true, awayTeam: true, predictions: true },
      },
    },
  });
}

export async function getSimulation(scope = "FULL") {
  return prisma.simulationRun.findFirst({
    where: { scope },
    orderBy: { runAt: "desc" },
    include: { modelVersion: true },
  });
}

export async function getVenue(id: string) {
  return prisma.venue.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { kickoff: "asc" },
        include: { homeTeam: true, awayTeam: true, group: true },
      },
    },
  });
}

export async function getVenues() {
  return prisma.venue.findMany({ orderBy: { altitude: "desc" } });
}

export async function getPlayer(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      nationalTeam: true,
      metrics: { orderBy: { date: "desc" } },
      squadEntries: true,
    },
  });
}

export async function getTeamSquad(teamId: string) {
  return prisma.squadEntry.findMany({
    where: { teamId },
    include: { player: { include: { metrics: { where: { metricType: "impact" } } } } },
  });
}

export async function getDataSourceLogs() {
  return prisma.dataSourceLog.findMany({ orderBy: { runAt: "desc" }, take: 20 });
}

export async function getDataFreshness() {
  const log = await prisma.dataSourceLog.findFirst({ orderBy: { runAt: "desc" } });
  const model = await getActiveModel();
  return { lastIngest: log?.runAt ?? null, model };
}
