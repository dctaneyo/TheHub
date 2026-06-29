import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRun, mockPrepare, mockGetAuthSession, mockRequirePermission, mockCheckRateLimit, mockLogAudit } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockGetAuthSession: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockCheckRateLimit: vi.fn((): { allowed: boolean; retryAfterMs?: number } => ({ allowed: true })),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ getAuthSession: mockGetAuthSession, requirePermission: mockRequirePermission }));
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit, getClientIP: vi.fn(() => "192.168.1.1") }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));

import { POST } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost/api/data-management/purge-notifications", { method: "POST" });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/purge-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 4 });
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks DATA_MANAGEMENT_ACCESS", async () => {
    const { ApiErrors } = await import("@/lib/api-response");
    mockRequirePermission.mockResolvedValue(ApiErrors.forbidden());
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("scopes both deletes to the caller's tenant", async () => {
    await POST(makeRequest());

    const calls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(calls).toHaveLength(2);
    for (const sql of calls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }
    expect(mockRun).toHaveBeenCalledWith("tenant-a");
  });

  it("returns counts and logs the audit entry", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedNotifications).toBe(4);
    expect(json.deletedEmergency).toBe(4);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "purge", entityType: "notifications" }));
  });

  it("still purges notifications even if emergency_messages delete fails", async () => {
    mockRun
      .mockReturnValueOnce({ changes: 4 }) // notifications
      .mockImplementationOnce(() => { throw new Error("no such table"); }); // emergency_messages

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedNotifications).toBe(4);
    expect(json.deletedEmergency).toBe(0);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
