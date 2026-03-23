import { describe, it, expect } from "vitest";
import { getPhaseForHour, PHASE_CONFIG, type DayPhase } from "./day-phase-context";

describe("getPhaseForHour", () => {
  const cases: [number, DayPhase][] = [
    [0, "night"],
    [4, "night"],
    [5, "dawn"],
    [7, "dawn"],
    [8, "morning"],
    [10, "morning"],
    [11, "midday"],
    [13, "midday"],
    [14, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [19, "evening"],
    [20, "night"],
    [23, "night"],
  ];

  it.each(cases)("hour %i → %s", (hour, expected) => {
    expect(getPhaseForHour(hour)).toBe(expected);
  });

  it("covers all 24 hours without gaps", () => {
    for (let h = 0; h < 24; h++) {
      const phase = getPhaseForHour(h);
      expect(Object.keys(PHASE_CONFIG)).toContain(phase);
    }
  });
});

describe("PHASE_CONFIG", () => {
  it("defines all six phases", () => {
    const phases: DayPhase[] = [
      "dawn",
      "morning",
      "midday",
      "afternoon",
      "evening",
      "night",
    ];
    for (const p of phases) {
      expect(PHASE_CONFIG[p]).toBeDefined();
      expect(PHASE_CONFIG[p].gradient).toBeTruthy();
      expect(PHASE_CONFIG[p].particleColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PHASE_CONFIG[p].hours).toHaveLength(2);
    }
  });
});
