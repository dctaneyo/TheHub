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
  return new Request("http://localhost/api/data-management/purge-broadcast-data", { method: "POST" });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/purge-broadcast-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 3 });
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

  it("scopes every child-table delete through this tenant's broadcasts, and deletes children before the parent", async () => {
    await POST(makeRequest());

    const calls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(calls).toHaveLength(5);

    // viewers, reactions, messages, questions all scoped via broadcast_id IN (this tenant's broadcasts)
    for (const sql of calls.slice(0, 4)) {
      expect(sql).toMatch(/broadcast_id IN \(SELECT id FROM broadcasts WHERE tenant_id = \?\)/);
    }
    // broadcasts itself scoped directly
    expect(calls[4]).toMatch(/FROM broadcasts WHERE tenant_id = \?/);

    // children deleted before the parent (so the subquery still finds them)
    expect(calls[4]).toContain("DELETE FROM broadcasts");
    expect(calls.slice(0, 4).every((sql) => !sql.includes("DELETE FROM broadcasts WHERE tenant_id"))).toBe(true);
  });

  it("returns counts and logs the audit entry", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedBroadcasts).toBe(3);
    expect(json.deletedViewers).toBe(3);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "purge", entityType: "broadcast_data" }));
  });

  it("still purges the rest even if one child table delete fails", async () => {
    mockRun
      .mockImplementationOnce(() => { throw new Error("no such table: broadcast_viewers"); })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedViewers).toBe(0);
    expect(json.deletedBroadcasts).toBe(1);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
