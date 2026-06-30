import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAll, mockGet, mockPrepare, mockRequireAdminSession } = vi.hoisted(() => ({
  mockAll: vi.fn(),
  mockGet: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ all: mockAll, get: mockGet }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));

import { GET } from "./route";

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("GET /api/admin/system/usage-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ total: 0, online: 0, locations: 0, arls: 0 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns platform-wide stats with no tenant filter — this is the cross-tenant report, by design", async () => {
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveProperty("topLocations");
    expect(json).toHaveProperty("sessionStats");

    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    for (const sql of sqlCalls) {
      expect(sql).not.toMatch(/tenant_id/);
    }
  });

  it("falls back to zeroed session stats if that query fails", async () => {
    mockGet.mockImplementationOnce(() => { throw new Error("DB error"); });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.sessionStats).toEqual({ total: 0, online: 0, locations: 0, arls: 0 });
  });

  it("returns 500 on unexpected errors", async () => {
    mockAll.mockImplementationOnce(() => { throw new Error("DB unavailable"); });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
