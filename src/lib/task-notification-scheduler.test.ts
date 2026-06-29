import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCreateNotification, mockCreateNotificationBulk } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockCreateNotificationBulk: vi.fn(),
}));

vi.mock("./notifications", () => ({
  createNotification: mockCreateNotification,
  createNotificationBulk: mockCreateNotificationBulk,
}));

// Keep the real schema (table identities are used as map keys below) but
// replace db.select with a chain that returns canned per-table fixtures —
// every query in this module has the same .select().from(table).where().all()/.get()
// shape, so the table reference is enough to route each call.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    db: { select: () => mockSelect() },
  };
});

const dataByTable = new Map<unknown, unknown[]>();
let lastTable: unknown = null;

function mockSelect() {
  return {
    from(table: unknown) {
      lastTable = table;
      return {
        where() {
          return {
            all: () => dataByTable.get(lastTable) ?? [],
            get: () => (dataByTable.get(lastTable) ?? [])[0],
          };
        },
        orderBy() {
          return { all: () => dataByTable.get(lastTable) ?? [] };
        },
      };
    },
  };
}

import { schema } from "./db";
import { refreshTaskTimers } from "./task-notification-scheduler";

const TZ = "UTC";

const location = {
  id: "loc-1",
  tenantId: "t1",
  name: "Store 1",
  isActive: true,
  timezone: TZ,
};

const tenant = { id: "t1", timezone: TZ };

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    tenantId: "t1",
    title: "Restock",
    priority: "normal",
    dueTime: "14:00",
    dueDate: null,
    isRecurring: true,
    recurringType: "daily",
    recurringDays: null,
    biweeklyStart: null,
    locationId: null,
    isHidden: false,
    createdAt: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setSystemTimeUTC(hh: number, mm: number) {
  const now = new Date();
  now.setUTCHours(hh, mm, 0, 0);
  vi.setSystemTime(now);
}

describe("task-notification-scheduler catch-up", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCreateNotification.mockClear();
    mockCreateNotificationBulk.mockClear();
    dataByTable.clear();
    dataByTable.set(schema.locations, [location]);
    dataByTable.set(schema.tenants, [tenant]);
    dataByTable.set(schema.arls, []);
    dataByTable.set(schema.notifications, []); // no notifications sent yet today
    dataByTable.set(schema.taskCompletions, []); // task not completed
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a future timer (no immediate fire) when the due-soon window hasn't started yet", () => {
    dataByTable.set(schema.tasks, [task()]); // due 14:00, due-soon window starts 13:30
    setSystemTimeUTC(12, 0);

    refreshTaskTimers();

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("catches up a due-soon notification that was missed (window started, not yet overdue)", () => {
    dataByTable.set(schema.tasks, [task()]);
    setSystemTimeUTC(13, 45); // past 13:30 due-soon window, before 14:00 due time

    refreshTaskTimers();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "loc-1", type: "task_due_soon" })
    );
  });

  it("catches up an overdue notification that was missed, without also sending the now-moot due-soon one", () => {
    dataByTable.set(schema.tasks, [task()]);
    setSystemTimeUTC(15, 0); // well past the 14:00 due time

    refreshTaskTimers();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "loc-1", type: "task_overdue" })
    );
  });

  it("does not re-fire a catch-up notification that was already sent today", () => {
    dataByTable.set(schema.tasks, [task()]);
    dataByTable.set(schema.notifications, [
      { userId: "loc-1", type: "task_overdue", metadata: JSON.stringify({ taskId: "task-1" }) },
    ]);
    setSystemTimeUTC(15, 0);

    refreshTaskTimers();

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not catch up a task that was already completed today", () => {
    dataByTable.set(schema.tasks, [task()]);
    dataByTable.set(schema.taskCompletions, [{ taskId: "task-1", locationId: "loc-1" }]);
    setSystemTimeUTC(15, 0);

    refreshTaskTimers();

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("re-deriving the schedule twice in a row (simulating the safety sweep) only fires the catch-up once", () => {
    dataByTable.set(schema.tasks, [task()]);
    setSystemTimeUTC(15, 0);

    refreshTaskTimers();
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);

    // Second pass: the notification from the first pass would now show up
    // in a real DB query, but our fixture data doesn't auto-update — this
    // confirms the *mechanism* (the alreadyNotified check) is exercised on
    // every call, not just skipped after the first.
    dataByTable.set(schema.notifications, [
      { userId: "loc-1", type: "task_overdue", metadata: JSON.stringify({ taskId: "task-1" }) },
    ]);
    refreshTaskTimers();
    expect(mockCreateNotification).toHaveBeenCalledTimes(1); // still 1, not 2
  });
});
