// Seeded Monte Carlo group simulation built on stored per-match Poisson rates.
// Samples scorelines from the model's lambdas to produce qualification
// probabilities and projected standings. Deterministic given the seed.

import type { FeatureSnapshot } from "./types";

type SimMatch = {
  homeName: string;
  awayName: string;
  lambdaHome: number;
  lambdaAway: number;
};

export type StandingRow = {
  team: string;
  expPoints: number;
  expGoalDiff: number;
  pFirst: number;
  pSecond: number;
  pTop2: number;
};

// Mulberry32 — small deterministic PRNG so simulations are reproducible.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePoisson(lambda: number, rng: () => number): number {
  // Knuth's algorithm — fine for the small lambdas in football.
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

export function simulateGroup(
  matches: SimMatch[],
  teams: string[],
  iterations = 5000,
  seed = 2026,
): StandingRow[] {
  const rng = mulberry32(seed);
  const idx = new Map(teams.map((t, i) => [t, i]));
  const n = teams.length;

  const firstCount = new Array(n).fill(0);
  const secondCount = new Array(n).fill(0);
  const top2Count = new Array(n).fill(0);
  const ptsSum = new Array(n).fill(0);
  const gdSum = new Array(n).fill(0);

  for (let it = 0; it < iterations; it++) {
    const pts = new Array(n).fill(0);
    const gd = new Array(n).fill(0);
    const gf = new Array(n).fill(0);

    for (const m of matches) {
      const hi = idx.get(m.homeName)!;
      const ai = idx.get(m.awayName)!;
      const hs = samplePoisson(m.lambdaHome, rng);
      const as = samplePoisson(m.lambdaAway, rng);
      gd[hi] += hs - as;
      gd[ai] += as - hs;
      gf[hi] += hs;
      gf[ai] += as;
      if (hs > as) pts[hi] += 3;
      else if (hs < as) pts[ai] += 3;
      else {
        pts[hi] += 1;
        pts[ai] += 1;
      }
    }

    ptsSum.forEach((_, i) => {
      ptsSum[i] += pts[i];
      gdSum[i] += gd[i];
    });

    // rank: points, then goal difference, then goals for, then random
    const order = teams
      .map((_, i) => i)
      .sort((a, b) =>
        pts[b] - pts[a] || gd[b] - gd[a] || gf[b] - gf[a] || rng() - 0.5,
      );
    firstCount[order[0]]++;
    secondCount[order[1]]++;
    top2Count[order[0]]++;
    top2Count[order[1]]++;
  }

  return teams
    .map((team, i) => ({
      team,
      expPoints: +(ptsSum[i] / iterations).toFixed(2),
      expGoalDiff: +(gdSum[i] / iterations).toFixed(2),
      pFirst: firstCount[i] / iterations,
      pSecond: secondCount[i] / iterations,
      pTop2: top2Count[i] / iterations,
    }))
    .sort((a, b) => b.pTop2 - a.pTop2 || b.expPoints - a.expPoints);
}

export function matchesFromGroup(
  groupMatches: { homeTeam: { name: string } | null; awayTeam: { name: string } | null; predictions: { featuresSnapshot: string }[] }[],
): SimMatch[] {
  const out: SimMatch[] = [];
  for (const m of groupMatches) {
    if (!m.homeTeam || !m.awayTeam || m.predictions.length === 0) continue;
    const f = JSON.parse(m.predictions[0].featuresSnapshot) as FeatureSnapshot;
    out.push({
      homeName: m.homeTeam.name,
      awayName: m.awayTeam.name,
      lambdaHome: f.lambdaHome,
      lambdaAway: f.lambdaAway,
    });
  }
  return out;
}
