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

export type ModelMetrics = {
  logloss: number; brier: number; rps: number; accuracy: number;
  baselineLogloss: number; baselineAccuracy: number; testMatches: number;
  params?: Record<string, number>;
};
