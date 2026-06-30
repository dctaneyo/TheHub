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
  return new Request("http://localhost/api/admin/tenants/tenant-a/data-management/purge-old-tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "tenant-a" }) };
const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/tenants/[id]/data-management/purge-old-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockRun.mockReturnValue({ changes: 7 });
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

  it("scopes the delete via the task's tenant, not any location", async () => {
    await POST(makeRequest(), ctx);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toMatch(/task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/);
    expect(mockRun).toHaveBeenCalledWith(expect.any(String), "tenant-a");
  });

  it("uses a 90-day cutoff", async () => {
    await POST(makeRequest(), ctx);
    const cutoffDate = mockRun.mock.calls[0][0] as string; // YYYY-MM-DD, date-only
    const expected = new Date();
    expected.setDate(expected.getDate() - 90);
    expect(cutoffDate).toBe(expected.toISOString().split("T")[0]);
  });

  it("logs the audit entry under the route's tenant id", async () => {
    const res = await POST(makeRequest(), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.deletedCompletions).toBe(7);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a", userId: "admin-1", userType: "platform_admin", operation: "purge", entityType: "task_completions",
    }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockRun.mockImplementationOnce(() => { throw new Error("DB unavailable"); });
    const res = await POST(makeRequest(), ctx);
    expect(res.status).toBe(500);
  });
});
