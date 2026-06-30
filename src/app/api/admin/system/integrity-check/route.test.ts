import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockPrepare, mockRequireAdminSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ get: mockGet }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));

import { GET } from "./route";

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("GET /api/admin/system/integrity-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockGet.mockReturnValue({ c: 0, integrity_check: "ok" });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports healthy when there are no issues and PRAGMA integrity_check is ok", async () => {
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.healthy).toBe(true);
    expect(json.issues).toEqual([]);
  });

  it("flags an issue when a query reports orphaned rows", async () => {
    mockGet
      .mockReturnValueOnce({ c: 5 }) // messages without conversations
      .mockReturnValueOnce({ c: 0 })
      .mockReturnValueOnce({ c: 0 })
      .mockReturnValueOnce({ c: 0 })
      .mockReturnValueOnce({ c: 0 })
      .mockReturnValueOnce({ c: 0 })
      .mockReturnValueOnce({ integrity_check: "ok" });
    const res = await GET();
    const json = await res.json();
    expect(json.healthy).toBe(false);
    expect(json.issues).toContainEqual(expect.objectContaining({ table: "messages", count: 5 }));
  });

  it("is not tenant-scoped — none of the checks filter by tenant_id", async () => {
    await GET();
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    for (const sql of sqlCalls) {
      expect(sql).not.toMatch(/tenant_id/);
    }
  });
});
