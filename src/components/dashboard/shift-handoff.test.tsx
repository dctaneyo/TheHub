import { describe, it, expect } from "vitest";
import { getShiftPeriod } from "./shift-handoff";

describe("getShiftPeriod", () => {
  it("returns morning for hours before 12", () => {
    expect(getShiftPeriod(0)).toBe("morning");
    expect(getShiftPeriod(6)).toBe("morning");
    expect(getShiftPeriod(11)).toBe("morning");
  });

  it("returns afternoon for hours 12-16", () => {
    expect(getShiftPeriod(12)).toBe("afternoon");
    expect(getShiftPeriod(14)).toBe("afternoon");
    expect(getShiftPeriod(16)).toBe("afternoon");
  });

  it("returns evening for hours 17+", () => {
    expect(getShiftPeriod(17)).toBe("evening");
    expect(getShiftPeriod(20)).toBe("evening");
    expect(getShiftPeriod(23)).toBe("evening");
  });
});
