import { describe, it, expect } from "vitest";
import { taskApplies, type CalTask } from "./task-calendar";

function task(overrides: Partial<CalTask> = {}): CalTask {
  return {
    id: "t1",
    title: "Test",
    type: "task",
    priority: "normal",
    dueTime: "09:00",
    dueDate: null,
    isRecurring: false,
    recurringType: null,
    recurringDays: null,
    locationId: null,
    ...overrides,
  };
}

// taskApplies() is a thin adapter over task-utils.ts's taskAppliesToDate —
// the recurrence math itself is covered by task-utils.test.ts. These tests
// just confirm the adapter computes dateStr/dayKey correctly and passes
// checkVisibility=false (the calendar shows every due task, not just the
// ones flagged to show in dashboard views).
describe("taskApplies", () => {
  it("applies a non-recurring task on its exact due date", () => {
    const t = task({ dueDate: "2026-06-22" });
    expect(taskApplies(t, new Date("2026-06-22T12:00:00"))).toBe(true);
    expect(taskApplies(t, new Date("2026-06-23T12:00:00"))).toBe(false);
  });

  it("applies a daily recurring task every day", () => {
    const t = task({ isRecurring: true, recurringType: "daily" });
    expect(taskApplies(t, new Date("2026-06-22T12:00:00"))).toBe(true);
    expect(taskApplies(t, new Date("2026-07-04T12:00:00"))).toBe(true);
  });

  it("applies a weekly task only on its configured day", () => {
    const t = task({ isRecurring: true, recurringType: "weekly", recurringDays: '["mon"]' });
    expect(taskApplies(t, new Date("2026-06-22T12:00:00"))).toBe(true); // a Monday
    expect(taskApplies(t, new Date("2026-06-23T12:00:00"))).toBe(false); // a Tuesday
  });

  it("does not apply a recurring task before its createdAt date", () => {
    const t = task({ isRecurring: true, recurringType: "daily", createdAt: "2026-06-22T00:00:00" });
    expect(taskApplies(t, new Date("2026-06-21T12:00:00"))).toBe(false);
    expect(taskApplies(t, new Date("2026-06-22T12:00:00"))).toBe(true);
  });
});
