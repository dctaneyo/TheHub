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
          groupBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              all: mockDbAll,
            })),
          })),
        })),
      })),
    })),
  },
  schema: {
    moodCheckins: {
      id: "id",
      tenantId: "tenant_id",
      locationId: "location_id",
      date: "date",
      moodScore: "mood_score",
      createdAt: "created_at",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: () => "test-mood-uuid",
}));

vi.mock("@/lib/socket-emit", () => ({
  broadcastMoodUpdated: vi.fn(),
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

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/mood-checkins", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/mood-checkins");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

describe("POST /api/mood-checkins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockReturnValue({ avg: 3.5 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makePostRequest({ moodScore: 3 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is ARL", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    const res = await POST(makePostRequest({ moodScore: 3 }));
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("returns 400 for moodScore below 1", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: 0 }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.message).toContain("moodScore");
  });

  it("returns 400 for moodScore above 5", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: 6 }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.message).toContain("moodScore");
  });

  it("returns 400 for non-integer moodScore", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: 3.5 }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.message).toContain("moodScore");
  });

  it("returns 400 for string moodScore", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: "happy" }));
    const json = await res.json();
    expect(res.status).toBe(400);
  });

  it("creates mood check-in for valid score", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: 4 }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.id).toBe("test-mood-uuid");
  });

  it("accepts boundary value 1", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: 1 }));
    expect(res.status).toBe(201);
  });

  it("accepts boundary value 5", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await POST(makePostRequest({ moodScore: 5 }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/mood-checkins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is location", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("returns aggregated data for ARL", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    mockDbAll.mockReturnValue([
      { date: "2026-01-15", locationId: "loc-1", moodScore: 3.5, count: 4 },
    ]);
    const res = await GET(makeGetRequest({ startDate: "2026-01-01", endDate: "2026-01-31" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.checkins).toHaveLength(1);
    expect(json.checkins[0].moodScore).toBe(3.5);
  });
});
