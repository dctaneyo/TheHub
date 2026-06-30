import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockRun, mockExec, mockPrepare, mockRequireAdminSession, mockVerifyPin, mockLogAudit } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockExec: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockVerifyPin: vi.fn(),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ get: mockGet, run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare, exec: mockExec } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/admin-auth", () => ({ verifyAdminPinReconfirmation: mockVerifyPin }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));

import { GET, POST } from "./route";

function makeGetRequest(): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/archive-old-data");
}
function makePostRequest(body: Record<string, unknown> = { dataType: "messages", daysOld: 180, pin: "123456" }): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/archive-old-data", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("GET /api/admin/tenants/[id]/data-management/archive-old-data (stats)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockGet.mockReturnValue({ c: 3 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await GET(makeGetRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("does not require a PIN — read-only stats", async () => {
    const res = await GET(makeGetRequest(), ctx);
    expect(res.status).toBe(200);
    expect(mockVerifyPin).not.toHaveBeenCalled();
  });

  it("scopes both counts to the tenant id from the route param", async () => {
    await GET(makeGetRequest(), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
    expect(mockGet).toHaveBeenCalledWith("tenant-a");
  });
});

describe("POST /api/admin/tenants/[id]/data-management/archive-old-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockRun.mockReturnValue({ changes: 6 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makePostRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makePostRequest({ dataType: "messages" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makePostRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid dataType", async () => {
    const res = await POST(makePostRequest({ dataType: "bogus", pin: "123456" }), ctx);
    expect(res.status).toBe(400);
  });

  it("scopes the messages archive insert+delete to the tenant id from the route param", async () => {
    await POST(makePostRequest({ dataType: "messages", daysOld: 180, pin: "123456" }), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO archived_messages"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("DELETE FROM messages"))).toBe(true);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
  });

  it("scopes the task-completions archive insert+delete to the tenant id from the route param", async () => {
    await POST(makePostRequest({ dataType: "task-completions", daysOld: 90, pin: "123456" }), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO archived_task_completions"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("DELETE FROM task_completions"))).toBe(true);
  });

  it("logs the audit entry under the route's tenant id", async () => {
    const res = await POST(makePostRequest(), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.archived).toBe(6);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a", userId: "admin-1", userType: "platform_admin", operation: "archive", entityType: "messages",
    }));
  });
});
