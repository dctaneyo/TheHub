import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockRun, mockPrepare, mockRequireAdminSession, mockVerifyPin, mockLogAudit } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockVerifyPin: vi.fn(),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ get: mockGet, run: mockRun }));

vi.mock("@/lib/db", () => ({
  sqlite: { prepare: mockPrepare },
}));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/admin-auth", () => ({ verifyAdminPinReconfirmation: mockVerifyPin }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown> = { pin: "123456" }): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/purge-conversations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/tenants/[id]/data-management/purge-conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockGet.mockReturnValue({ id: "global-convo-1" });
    mockRun.mockReturnValue({ changes: 3 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makeRequest({}), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("scopes every query to the tenant id from the route param", async () => {
    await POST(makeRequest(), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.length).toBeGreaterThan(0);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
  });

  it("preserves the tenant's global conversation, deleting only non-global ones", async () => {
    await POST(makeRequest(), ctx);
    const deleteConvoSql = mockPrepare.mock.calls.map((c) => c[0] as string).find((sql) => sql.includes("DELETE FROM conversations"));
    expect(deleteConvoSql).toMatch(/type\s*!=\s*'global'/);
  });

  it("creates a new global conversation if the tenant has none", async () => {
    mockGet.mockReturnValueOnce(undefined); // no existing global convo
    mockGet.mockReturnValueOnce(undefined); // re-check after delete: still none
    await POST(makeRequest(), ctx);
    const insertSql = mockPrepare.mock.calls.map((c) => c[0] as string).find((sql) => sql.includes("INSERT INTO conversations"));
    expect(insertSql).toBeDefined();
  });

  it("logs the audit entry under the route's tenant id", async () => {
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a", userId: "admin-1", userType: "platform_admin", operation: "purge", entityType: "conversations",
    }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockGet.mockImplementationOnce(() => { throw new Error("DB unavailable"); });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(500);
  });
});
