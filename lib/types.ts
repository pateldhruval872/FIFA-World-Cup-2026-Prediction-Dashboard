// Parsed shapes for JSON columns written by the ML pipeline.

export type ScoreLine = { score: string; p: number };

export type KeyFactor = {
  factor: string;
  detail: string;
  impact: "High" | "Medium" | "Low";
  direction: string;
};

export type FeatureSnapshot = {
  homeElo: number;
  awayElo: number;
  eloDiff: number;
  neutral: boolean;
  lambdaHome: number;
  lambdaAway: number;
  homeForm: TeamFormSnapshot | null;
  awayForm: TeamFormSnapshot | null;
};

export type TeamFormSnapshot = {
  gf: number; ga: number; last5: number; attack: number; defense: number;
};

export type SimTeam = {
  team: string;
  elo: number;
  pFirst: number;
  pTop2: number;
  expPoints: number;
  expGoalDiff: number;
  pKO: number;
  pR16: number;
  pQF: number;
  pSF: number;
  pFinal: number;
  pChampion: number;
};

export type SimulationResults = {
  seed: number;
  iterations: number;
  groups: Record<string, string[]>;
  teams: SimTeam[];
};

export type ModelMetrics = {
  logloss: number; brier: number; rps: number; accuracy: number;
  baselineLogloss: number; baselineAccuracy: number; testMatches: number;
  params?: Record<string, number>;
};
