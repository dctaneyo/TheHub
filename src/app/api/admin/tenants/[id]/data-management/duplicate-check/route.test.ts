import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAll, mockRun, mockPrepare, mockRequireAdminSession, mockVerifyPin } = vi.hoisted(() => ({
  mockAll: vi.fn(),
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockVerifyPin: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ all: mockAll, run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/admin-auth", () => ({ verifyAdminPinReconfirmation: mockVerifyPin }));

import { GET, POST } from "./route";

function makeGetRequest(): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/duplicate-check");
}
function makePostRequest(body: Record<string, unknown> = { pin: "123456" }): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/duplicate-check", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("GET /api/admin/tenants/[id]/data-management/duplicate-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockAll.mockReturnValue([]);
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await GET(makeGetRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("does not require a PIN — read-only detection", async () => {
    const res = await GET(makeGetRequest(), ctx);
    expect(res.status).toBe(200);
    expect(mockVerifyPin).not.toHaveBeenCalled();
  });

  it("scopes every detection query to the tenant id from the route param", async () => {
    await GET(makeGetRequest(), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.length).toBe(3);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
  });

  it("reports hasDuplicates true when any category has dupes", async () => {
    mockAll
      .mockReturnValueOnce([{ type: "direct", name: "x", c: 2 }])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const res = await GET(makeGetRequest(), ctx);
    const json = await res.json();
    expect(json.hasDuplicates).toBe(true);
    expect(json.duplicates).toHaveLength(1);
  });
});

describe("POST /api/admin/tenants/[id]/data-management/duplicate-check (removal)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockRun.mockReturnValue({ changes: 2 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makePostRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makePostRequest({}), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makePostRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("scopes every removal query to the tenant id from the route param", async () => {
    await POST(makePostRequest(), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.length).toBe(2);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
  });

  it("returns removal totals", async () => {
    const res = await POST(makePostRequest(), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.removedCompletions).toBe(2);
    expect(json.removedSessions).toBe(2);
    expect(json.total).toBe(4);
  });
});
