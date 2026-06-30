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

vi.mock("@/lib/api-helpers", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/admin-auth", () => ({
  verifyAdminPinReconfirmation: mockVerifyPin,
}));

vi.mock("@/lib/audit-logger", () => ({
  logAudit: mockLogAudit,
}));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown> = { pin: "123456" }): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/purge-messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/tenants/[id]/data-management/purge-messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockGet.mockReturnValue({ c: 5 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    const denied = new Response(null, { status: 401 });
    mockRequireAdminSession.mockResolvedValue({ response: denied });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("requires a pin in the request body", async () => {
    const res = await POST(makeRequest({}), ctx);
    expect(res.status).toBe(400);
    expect(mockVerifyPin).not.toHaveBeenCalled();
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("checks the PIN against the admin's own id, not any tenant value", async () => {
    await POST(makeRequest(), ctx);
    expect(mockVerifyPin).toHaveBeenCalledWith("admin-1", "123456");
  });

  // ── The critical safety property carried over from the original route:
  // every query must be scoped to the tenant from the route's [id] param,
  // not from any session — there's no ARL session here, only the admin's.
  it("scopes every count and delete query to the tenant id from the route param", async () => {
    await POST(makeRequest(), ctx);

    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.length).toBeGreaterThan(0);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
    expect(mockGet).toHaveBeenCalledWith("tenant-a");
    expect(mockRun).toHaveBeenCalledWith("tenant-a");
  });

  it("returns the counted totals and logs the audit entry under the route's tenant id", async () => {
    const res = await POST(makeRequest(), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedMessages).toBe(5);
    expect(json.deletedReads).toBe(5);
    expect(json.deletedReactions).toBe(5);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a", userId: "admin-1", userType: "platform_admin", operation: "purge", entityType: "messages",
    }));
  });

  it("still purges messages/reads even if the reactions table doesn't exist", async () => {
    mockGet
      .mockImplementationOnce(() => { throw new Error("no such table: message_reactions"); })
      .mockReturnValueOnce({ c: 3 })
      .mockReturnValueOnce({ c: 2 });
    mockRun
      .mockImplementationOnce(() => { throw new Error("no such table: message_reactions"); })
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const res = await POST(makeRequest(), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedReactions).toBe(0);
    expect(json.deletedMessages).toBe(3);
    expect(json.deletedReads).toBe(2);
  });

  it("returns 500 on unexpected errors", async () => {
    // The reactions count is wrapped in its own try/catch (table may not
    // exist), so the first get() throwing is tolerated — fail on the
    // second (unguarded) call instead, the messages count.
    mockGet
      .mockReturnValueOnce({ c: 0 })
      .mockImplementationOnce(() => { throw new Error("DB unavailable"); });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(500);
  });
});
