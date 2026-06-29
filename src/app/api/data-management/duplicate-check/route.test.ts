import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAll, mockRun, mockPrepare, mockGetAuthSession, mockRequirePermission, mockCheckRateLimit } = vi.hoisted(() => ({
  mockAll: vi.fn((): unknown[] => []),
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockGetAuthSession: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockCheckRateLimit: vi.fn((): { allowed: boolean; retryAfterMs?: number } => ({ allowed: true })),
}));

mockPrepare.mockImplementation(() => ({ all: mockAll, run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ getAuthSession: mockGetAuthSession, requirePermission: mockRequirePermission }));
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit, getClientIP: vi.fn(() => "192.168.1.1") }));

import { GET, POST } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost/api/data-management/duplicate-check", { method: "POST" });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("GET /api/data-management/duplicate-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockAll.mockReturnValue([]);
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks DATA_MANAGEMENT_ACCESS", async () => {
    const { ApiErrors } = await import("@/lib/api-response");
    mockRequirePermission.mockResolvedValue(ApiErrors.forbidden());
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("scopes the conversation, task-completion, and session dedup queries to this tenant", async () => {
    await GET();

    const calls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatch(/FROM conversations WHERE tenant_id = \?/); // conversations
    expect(calls[1]).toMatch(/task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/); // completions
    expect(calls[2]).toMatch(/\(user_type = 'location' AND user_id IN \(SELECT id FROM locations WHERE tenant_id = \?\)\)/); // sessions
  });

  it("reports duplicate conversations found in this tenant", async () => {
    mockAll
      .mockReturnValueOnce([{ type: "direct", name: "Jane & Bob", c: 2 }])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const res = await GET();
    const json = await res.json();

    expect(json.hasDuplicates).toBe(true);
    expect(json.duplicates[0]).toMatchObject({ type: "conversation", count: 2 });
  });

  it("returns hasDuplicates: false when nothing is found", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.hasDuplicates).toBe(false);
    expect(json.duplicates).toEqual([]);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/data-management/duplicate-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 2 });
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("scopes both the perimeter and the de-dup grouping to this tenant for completions", async () => {
    await POST(makeRequest());

    const sql = mockPrepare.mock.calls[0][0] as string;
    // both the outer WHERE and the inner MIN(rowid) subquery must filter
    // by tenant — otherwise a row could be "the tenant's" but still get
    // compared against a global minimum from another tenant's rows
    const tenantMatches = sql.match(/tenant_id = \?/g) || [];
    expect(tenantMatches.length).toBe(2);
    expect(mockRun.mock.calls[0]).toEqual(["tenant-a", "tenant-a"]);
  });

  it("scopes both the perimeter and the de-dup grouping to this tenant for sessions", async () => {
    await POST(makeRequest());

    const sql = mockPrepare.mock.calls[1][0] as string;
    const tenantMatches = sql.match(/tenant_id = \?/g) || [];
    expect(tenantMatches.length).toBe(4); // 2 branches (location/arl) x 2 (outer + subquery)
    expect(mockRun.mock.calls[1]).toEqual(["tenant-a", "tenant-a", "tenant-a", "tenant-a"]);
  });

  it("returns removal counts", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.removedCompletions).toBe(2);
    expect(json.removedSessions).toBe(2);
    expect(json.total).toBe(4);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
