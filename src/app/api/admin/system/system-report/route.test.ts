import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAll, mockPrepareSqlite, mockRequireAdminSession, mockExistsSync, mockStatSync } = vi.hoisted(() => ({
  mockAll: vi.fn(() => []),
  mockPrepareSqlite: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
}));

mockPrepareSqlite.mockImplementation(() => ({ all: vi.fn(() => []), get: vi.fn(() => ({ c: 0 })) }));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: { select: () => ({ from: () => ({ all: mockAll }) }) },
    sqlite: { prepare: mockPrepareSqlite },
  };
});
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("fs", () => ({ default: { existsSync: mockExistsSync, statSync: mockStatSync } }));

import { GET } from "./route";

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("GET /api/admin/system/system-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockAll.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 5000 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns counts, database, and system sections — cross-tenant by design", async () => {
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveProperty("counts");
    expect(json).toHaveProperty("database");
    expect(json).toHaveProperty("system");
    expect(json.database.size).toBe(5000);
  });

  it("tolerates an individual count query failing without a 500", async () => {
    mockAll.mockImplementationOnce(() => []).mockImplementationOnce(() => []).mockImplementationOnce(() => [])
      .mockImplementationOnce(() => []).mockImplementationOnce(() => []).mockImplementationOnce(() => [])
      .mockImplementationOnce(() => []).mockImplementationOnce(() => { throw new Error("table missing"); });
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
