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

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/data-management/clear-sessions", { method: "POST", body: JSON.stringify(body) });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const, sessionCode: "123456" };

// This route's tenant-scoping fragment OR's two branches together
// (user_type='location' AND ... ) OR (user_type='arl' AND ...), each
// referencing a different table — both branches must be present, and
// the whole thing must be parenthesized so it doesn't silently weaken
// the rest of the WHERE clause via operator precedence.
function expectTenantScoped(sql: string) {
  expect(sql).toMatch(/\(\s*\(user_type = 'location' AND user_id IN \(SELECT id FROM locations WHERE tenant_id = \?\)\)\s*OR\s*\(user_type = 'arl' AND user_id IN \(SELECT id FROM arls WHERE tenant_id = \?\)\)\s*\)/);
}

describe("POST /api/data-management/clear-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 6 });
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ mode: "stale" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks DATA_MANAGEMENT_ACCESS", async () => {
    const { ApiErrors } = await import("@/lib/api-response");
    mockRequirePermission.mockResolvedValue(ApiErrors.forbidden());
    const res = await POST(makeRequest({ mode: "stale" }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await POST(makeRequest({ mode: "stale" }));
    expect(res.status).toBe(429);
  });

  it("rejects an unrecognized mode", async () => {
    const res = await POST(makeRequest({ mode: "explode" }));
    expect(res.status).toBe(400);
  });

  it("mode=stale: scopes to this tenant's own location/ARL sessions", async () => {
    await POST(makeRequest({ mode: "stale" }));
    const sql = mockPrepare.mock.calls[0][0] as string;
    expectTenantScoped(sql);
    expect(mockRun).toHaveBeenCalledWith(expect.any(String), "tenant-a", "tenant-a");
  });

  it("mode=all-offline: scopes to this tenant", async () => {
    await POST(makeRequest({ mode: "all-offline" }));
    const sql = mockPrepare.mock.calls[0][0] as string;
    expectTenantScoped(sql);
    expect(mockRun).toHaveBeenCalledWith("tenant-a", "tenant-a");
  });

  it("mode=force-all: scopes to this tenant and spares the caller's own session", async () => {
    await POST(makeRequest({ mode: "force-all" }));
    const sql = mockPrepare.mock.calls[0][0] as string;
    expectTenantScoped(sql);
    expect(sql).toMatch(/session_code != \?/);
    expect(mockRun).toHaveBeenCalledWith("123456", "tenant-a", "tenant-a");
  });

  it("mode=force-all: tolerates a caller session with no sessionCode", async () => {
    mockGetAuthSession.mockResolvedValue({ ...adminSession, sessionCode: undefined });
    const res = await POST(makeRequest({ mode: "force-all" }));
    expect(res.status).toBe(200);
    expect(mockRun).toHaveBeenCalledWith("", "tenant-a", "tenant-a");
  });

  it("returns the deleted count and mode, and logs the audit entry", async () => {
    const res = await POST(makeRequest({ mode: "stale" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(6);
    expect(json.mode).toBe("stale");
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "clear_sessions", payload: { mode: "stale" } }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest({ mode: "stale" }));
    expect(res.status).toBe(500);
  });
});
