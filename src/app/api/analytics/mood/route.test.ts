import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthSession = vi.fn();
const mockRequirePermission = vi.fn();
const mockSqlitePrepare = vi.fn();
const mockDbGet = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  getAuthSession: () => mockGetAuthSession(),
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { ANALYTICS_ACCESS: "analytics.access" },
  parseAssignedLocations: (raw: string | null) => {
    if (!raw) return null;
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length > 0 ? arr : null;
    } catch {
      return null;
    }
  },
}));

vi.mock("@/lib/db", () => ({
  sqlite: {
    prepare: (...args: unknown[]) => mockSqlitePrepare(...args),
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbGet,
        })),
      })),
    })),
  },
  schema: {
    arls: {
      id: "id",
      tenantId: "tenant_id",
      role: "role",
      assignedLocationIds: "assigned_location_ids",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

import { GET } from "./route";

const arlSession = {
  id: "arl-1",
  userType: "arl" as const,
  tenantId: "kazi",
  name: "Test ARL",
};

const locationSession = {
  id: "loc-1",
  userType: "location" as const,
  tenantId: "kazi",
  name: "Test Location",
};

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/analytics/mood");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

describe("GET /api/analytics/mood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(null);
    mockDbGet.mockReturnValue({ role: "admin", assignedLocationIds: null });
  });

  it("returns 403 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is location", async () => {
    mockGetAuthSession.mockResolvedValue(locationSession);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid days parameter", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    const res = await GET(makeRequest({ days: "5" }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.message).toContain("days");
  });

  it("returns mood data for valid request with days=7", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    const mockRows = [
      { date: "2026-01-15", locationId: "loc-1", locationName: "Store A", avgMood: 3.5, checkinCount: 4 },
      { date: "2026-01-16", locationId: "loc-1", locationName: "Store A", avgMood: 4.0, checkinCount: 3 },
    ];
    mockSqlitePrepare.mockReturnValue({ all: vi.fn().mockReturnValue(mockRows) });

    const res = await GET(makeRequest({ days: "7" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].avgMood).toBe(3.5);
  });

  it("accepts days=14", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    mockSqlitePrepare.mockReturnValue({ all: vi.fn().mockReturnValue([]) });
    const res = await GET(makeRequest({ days: "14" }));
    expect(res.status).toBe(200);
  });

  it("accepts days=30", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    mockSqlitePrepare.mockReturnValue({ all: vi.fn().mockReturnValue([]) });
    const res = await GET(makeRequest({ days: "30" }));
    expect(res.status).toBe(200);
  });

  it("defaults to 7 days when no days param", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    mockSqlitePrepare.mockReturnValue({ all: vi.fn().mockReturnValue([]) });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("filters by locationId when provided", async () => {
    mockGetAuthSession.mockResolvedValue(arlSession);
    const mockAll = vi.fn().mockReturnValue([]);
    mockSqlitePrepare.mockReturnValue({ all: mockAll });

    await GET(makeRequest({ days: "7", locationId: "loc-1" }));

    // Verify the query was called with locationId in params
    const callArgs = mockAll.mock.calls[0];
    expect(callArgs).toContain("loc-1");
  });
});
