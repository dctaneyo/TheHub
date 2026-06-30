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

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/clear-sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/tenants/[id]/data-management/clear-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockRun.mockReturnValue({ changes: 3 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest({ mode: "force-all", pin: "123456" }), ctx);
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makeRequest({ mode: "force-all" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makeRequest({ mode: "force-all", pin: "123456" }), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid mode", async () => {
    const res = await POST(makeRequest({ mode: "bogus", pin: "123456" }), ctx);
    expect(res.status).toBe(400);
  });

  it.each(["stale", "all-offline", "force-all"])("scopes mode=%s to the tenant id from the route param via locations/arls", async (mode) => {
    await POST(makeRequest({ mode, pin: "123456" }), ctx);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toMatch(/SELECT id FROM locations WHERE tenant_id = \?/);
    expect(sql).toMatch(/SELECT id FROM arls WHERE tenant_id = \?/);
    const runArgs = mockRun.mock.calls[0];
    expect(runArgs).toContain("tenant-a");
  });

  it("force-all has no 'except current session' exception, unlike the ARL self-service version", async () => {
    await POST(makeRequest({ mode: "force-all", pin: "123456" }), ctx);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/session_code/);
  });

  it("logs the audit entry with the mode and the route's tenant id", async () => {
    const res = await POST(makeRequest({ mode: "force-all", pin: "123456" }), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.deleted).toBe(3);
    expect(json.mode).toBe("force-all");
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a", userId: "admin-1", userType: "platform_admin", operation: "clear_sessions", payload: { mode: "force-all" },
    }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockRun.mockImplementationOnce(() => { throw new Error("DB unavailable"); });
    const res = await POST(makeRequest({ mode: "force-all", pin: "123456" }), ctx);
    expect(res.status).toBe(500);
  });
});
