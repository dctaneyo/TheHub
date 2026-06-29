import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockRun, mockPrepare, mockGetAuthSession, mockRequirePermission, mockCheckRateLimit, mockLogAudit } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockGetAuthSession: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockCheckRateLimit: vi.fn((): { allowed: boolean; retryAfterMs?: number } => ({ allowed: true })),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ get: mockGet, run: mockRun }));

vi.mock("@/lib/db", () => ({
  sqlite: { prepare: mockPrepare },
}));

vi.mock("@/lib/api-helpers", () => ({
  getAuthSession: mockGetAuthSession,
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIP: vi.fn(() => "192.168.1.1"),
}));

vi.mock("@/lib/audit-logger", () => ({
  logAudit: mockLogAudit,
}));

import { POST } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost/api/data-management/purge-messages", { method: "POST" });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/purge-messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockGet.mockReturnValue({ c: 5 });
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

  // ── The critical safety property: every query this route runs must be
  // scoped to the caller's own tenant. Messages, reads, and reactions have
  // no tenantId column of their own — scoping happens via the conversation
  // they belong to. A prior version of this route purged every tenant's
  // messages at once; every prepared statement below must carry the
  // tenant filter.
  it("scopes every count and delete query to the caller's tenant", async () => {
    await POST(makeRequest());

    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.length).toBeGreaterThan(0);
    for (const sql of sqlCalls) {
      expect(sql).toMatch(/tenant_id\s*=\s*\?/);
    }

    // Every run()/get() call passed the tenant ID as a parameter
    expect(mockGet).toHaveBeenCalledWith("tenant-a");
    expect(mockRun).toHaveBeenCalledWith("tenant-a");
  });

  it("returns the counted totals and logs the audit entry with this tenant's id", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedMessages).toBe(5);
    expect(json.deletedReads).toBe(5);
    expect(json.deletedReactions).toBe(5);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "purge", entityType: "messages" }));
  });

  it("still purges messages/reads even if the reactions table doesn't exist", async () => {
    mockGet
      .mockImplementationOnce(() => { throw new Error("no such table: message_reactions"); }) // reaction count
      .mockReturnValueOnce({ c: 3 }) // message count
      .mockReturnValueOnce({ c: 2 }); // read count
    mockRun
      .mockImplementationOnce(() => { throw new Error("no such table: message_reactions"); }) // reaction delete
      .mockReturnValueOnce(undefined) // read delete
      .mockReturnValueOnce(undefined); // message delete

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedReactions).toBe(0);
    expect(json.deletedMessages).toBe(3);
    expect(json.deletedReads).toBe(2);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGet.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
