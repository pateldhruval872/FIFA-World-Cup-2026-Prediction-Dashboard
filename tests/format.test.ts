import { describe, it, expect } from "vitest";
import { pct, favored, confidenceLabel, stageLabel } from "../lib/format";

describe("format helpers", () => {
  it("formats percentages", () => {
    expect(pct(0.625)).toBe("63%");
    expect(pct(0.625, 1)).toBe("62.5%");
  });

  it("picks the favoured outcome", () => {
    expect(favored(0.6, 0.25, 0.15)).toBe("home");
    expect(favored(0.2, 0.3, 0.5)).toBe("away");
    expect(favored(0.3, 0.5, 0.2)).toBe("draw");
  });

  it("bands confidence sensibly", () => {
    expect(confidenceLabel(0.7).label).toBe("High");
    expect(confidenceLabel(0.3).label).toBe("Moderate");
    expect(confidenceLabel(0.1).label).toBe("Low / toss-up");
  });

  it("labels stages", () => {
    expect(stageLabel("GROUP")).toBe("Group Stage");
    expect(stageLabel("FINAL")).toBe("Final");
    expect(stageLabel("R32")).toBe("Round of 32");
  });
});
