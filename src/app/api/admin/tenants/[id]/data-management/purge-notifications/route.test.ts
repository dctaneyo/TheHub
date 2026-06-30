import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRun, mockPrepare, mockRequireAdminSession, mockVerifyPin, mockLogAudit } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockVerifyPin: vi.fn(),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/admin-auth", () => ({ verifyAdminPinReconfirmation: mockVerifyPin }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown> = { pin: "123456" }): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/purge-notifications", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/tenants/[id]/data-management/purge-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockRun.mockReturnValue({ changes: 4 });
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

  it("scopes both deletes to the tenant id from the route param", async () => {
    await POST(makeRequest(), ctx);
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls).toEqual([
      "DELETE FROM notifications WHERE tenant_id = ?",
      "DELETE FROM emergency_messages WHERE tenant_id = ?",
    ]);
    expect(mockRun).toHaveBeenCalledWith("tenant-a");
  });

  it("logs the audit entry under the route's tenant id", async () => {
    const res = await POST(makeRequest(), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.deletedNotifications).toBe(4);
    expect(json.deletedEmergency).toBe(4);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a", userId: "admin-1", userType: "platform_admin", operation: "purge", entityType: "notifications",
    }));
  });
});
