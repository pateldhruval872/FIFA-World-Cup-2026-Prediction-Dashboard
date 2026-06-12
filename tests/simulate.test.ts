import { describe, it, expect } from "vitest";
import { simulateGroup } from "../lib/simulate";

const teams = ["Alpha", "Bravo", "Charlie", "Delta"];
const matches = [
  { homeName: "Alpha", awayName: "Bravo", lambdaHome: 2.2, lambdaAway: 0.7 },
  { homeName: "Charlie", awayName: "Delta", lambdaHome: 1.3, lambdaAway: 1.2 },
  { homeName: "Alpha", awayName: "Charlie", lambdaHome: 1.8, lambdaAway: 0.9 },
  { homeName: "Bravo", awayName: "Delta", lambdaHome: 1.1, lambdaAway: 1.1 },
  { homeName: "Alpha", awayName: "Delta", lambdaHome: 2.0, lambdaAway: 0.8 },
  { homeName: "Bravo", awayName: "Charlie", lambdaHome: 1.0, lambdaAway: 1.3 },
];

describe("simulateGroup", () => {
  it("is deterministic for a fixed seed", () => {
    const a = simulateGroup(matches, teams, 2000, 42);
    const b = simulateGroup(matches, teams, 2000, 42);
    expect(a).toEqual(b);
  });

  it("produces valid probabilities that respect the top-2 constraint", () => {
    const rows = simulateGroup(matches, teams, 4000, 7);
    for (const r of rows) {
      expect(r.pTop2).toBeGreaterThanOrEqual(0);
      expect(r.pTop2).toBeLessThanOrEqual(1);
      expect(r.pTop2).toBeCloseTo(r.pFirst + r.pSecond, 5);
    }
    // exactly two qualifying slots => probabilities sum to ~2 across the group
    const total = rows.reduce((s, r) => s + r.pTop2, 0);
    expect(total).toBeCloseTo(2, 1);
  });

  it("ranks the strongest team highest", () => {
    const rows = simulateGroup(matches, teams, 5000, 1);
    expect(rows[0].team).toBe("Alpha");
  });
});
