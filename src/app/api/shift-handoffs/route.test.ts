import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthSession = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  getAuthSession: () => mockGetAuthSession(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: mockDbRun,
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbGet,
          all: mockDbAll,
          orderBy: vi.fn(() => ({
            all: mockDbAll,
          })),
        })),
        all: vi.fn(() => ({
          filter: vi.fn(() => []),
        })),
      })),
    })),
  },
  schema: {
    shiftHandoffs: {
      id: "id",
      tenantId: "tenant_id",
      locationId: "location_id",
      shiftDate: "shift_date",
      shiftPeriod: "shift_period",
      completedTaskCount: "completed_task_count",
      remainingTaskCount: "remaining_task_count",
      createdAt: "created_at",
    },
    taskCompletions: {
      id: "id",
      taskId: "task_id",
      locationId: "location_id",
      completedDate: "completed_date",
    },
    tasks: {
      id: "id",
      tenantId: "tenant_id",
      isHidden: "is_hidden",
    },
    moodCheckins: {
      moodScore: "mood_score",
      locationId: "location_id",
      date: "date",
    },
    locations: {
      id: "id",
      name: "name",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: () => "test-handoff-uuid",
}));

vi.mock("@/lib/socket-emit", () => ({
  broadcastShiftHandoff: vi.fn(),
}));

import { GET, POST } from "./route";

const locationSession = {
  id: "loc-1",
  userType: "location" as const,
  tenantId: "kazi",
  name: "Test Location",
};

const arlSession = {
  id: "arl-1",
  userType: "arl" as const,
  tenantId: "kazi",
  name: "Test ARL",
};

function makePostRequest() {
  return new NextRequest("http://localhost/api/shift-handoffs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/shift-handoffs");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

describe("POST /api/shift-handoffs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing handoff, 0 completed tasks, no mood data
    mockDbGet.mockReturnValue(null);
    mockDbAll.mockReturnValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is ARL", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    const res = await POST(makePostRequest());
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("returns 409 when handoff already exists for this period", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    // First call to .get() returns existing handoff
    mockDbGet.mockReturnValueOnce({ id: "existing-handoff" });
    const res = await POST(makePostRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error.code).toBe("DUPLICATE");
  });

  it("creates handoff for valid location user", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    // No existing handoff
    mockDbGet
      .mockReturnValueOnce(null) // duplicate check
      .mockReturnValueOnce({ count: 5 }) // completed count
      .mockReturnValueOnce({ avg: 3.8 }) // mood avg
      .mockReturnValueOnce({ name: "Test Store" }); // location name
    mockDbAll.mockReturnValue([]);

    const res = await POST(makePostRequest());
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.id).toBe("test-handoff-uuid");
    expect(json.shiftPeriod).toBeDefined();
  });
});

describe("GET /api/shift-handoffs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns handoffs for location user", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    mockDbAll.mockReturnValue([
      {
        id: "h1",
        tenantId: "kazi",
        locationId: "loc-1",
        shiftDate: "2026-03-23",
        shiftPeriod: "morning",
        completedTaskCount: 10,
        remainingTaskCount: 2,
      },
    ]);
    const res = await GET(makeGetRequest({ date: "2026-03-23" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.handoffs).toHaveLength(1);
  });

  it("returns handoffs for ARL user with locationId filter", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    mockDbAll.mockReturnValue([]);
    const res = await GET(makeGetRequest({ locationId: "loc-1", date: "2026-03-23" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.handoffs).toBeDefined();
  });
});
