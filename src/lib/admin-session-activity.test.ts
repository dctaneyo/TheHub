import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAdminSessionIdle, touchAdminActivity, clearAdminActivity } from "./admin-session-activity";

describe("admin-session-activity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats an admin with no recorded activity as not idle", () => {
    expect(isAdminSessionIdle("admin-never-seen")).toBe(false);
  });

  it("is not idle immediately after touching", () => {
    touchAdminActivity("admin-1");
    expect(isAdminSessionIdle("admin-1")).toBe(false);
  });

  it("becomes idle after 5+ minutes of no activity", () => {
    touchAdminActivity("admin-2");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(isAdminSessionIdle("admin-2")).toBe(true);
  });

  it("stays active if touched again before the idle window elapses", () => {
    touchAdminActivity("admin-3");
    vi.advanceTimersByTime(4 * 60 * 1000);
    touchAdminActivity("admin-3");
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(isAdminSessionIdle("admin-3")).toBe(false);
  });

  it("clearAdminActivity removes the record, reverting to not-idle (benefit of the doubt)", () => {
    touchAdminActivity("admin-4");
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(isAdminSessionIdle("admin-4")).toBe(true);
    clearAdminActivity("admin-4");
    expect(isAdminSessionIdle("admin-4")).toBe(false);
  });
});
