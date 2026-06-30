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
  return new Request("http://localhost/api/admin/system/orphaned-cleanup", { method: "POST", body: JSON.stringify(body) });
}

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/system/orphaned-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockRun.mockReturnValue({ changes: 1 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  // ── Deliberately not tenant-scoped — every row here already lost its
  // parent, so there's no tenant left to attribute it to.
  it("is not tenant-scoped — none of the four cleanup queries filter by tenant_id", async () => {
    await POST(makeRequest());
    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.length).toBe(4);
    for (const sql of sqlCalls) {
      expect(sql).not.toMatch(/tenant_id/);
    }
  });

  it("tolerates one table's cleanup failing without aborting the rest", async () => {
    mockRun
      .mockImplementationOnce(() => { throw new Error("no such table"); })
      .mockReturnValueOnce({ changes: 2 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 3 });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.orphanedMessages).toBe(0);
    expect(json.total).toBe(6);
  });

  it("logs the audit entry with the total affected count", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.total).toBe(4);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: "admin-1", userType: "platform_admin", operation: "orphaned_cleanup", affectedCount: 4,
    }));
  });
});
