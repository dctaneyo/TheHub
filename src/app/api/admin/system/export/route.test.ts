import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAll, mockRequireAdminSession } = vi.hoisted(() => ({
  mockAll: vi.fn(() => []),
  mockRequireAdminSession: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: { select: () => ({ from: () => ({ all: mockAll }) }) },
  };
});
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));

import { GET } from "./route";

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("GET /api/admin/system/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockAll.mockReturnValue([]);
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  // ── This is the cross-tenant data dump — every tenant's data at once,
  // not just the caller's own. That's only safe because it's admin-only now
  // (moved off the tenant-level ARL session it used to run under).
  it("returns a JSON file attachment with every table, across every tenant", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);

    const body = JSON.parse(await res.text());
    expect(body).toHaveProperty("exportedBy", "Admin");
    expect(body.data).toHaveProperty("locations");
    expect(body.data).toHaveProperty("arls");
    expect(body.data).toHaveProperty("messages");
  });

  it("returns 500 on unexpected errors", async () => {
    mockAll.mockImplementationOnce(() => { throw new Error("DB unavailable"); });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
