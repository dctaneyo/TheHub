import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSqliteRun, mockSqlitePrepare, mockGetAuthSession, mockRequirePermission, mockCheckRateLimit, mockLogAudit } = vi.hoisted(() => ({
  mockSqliteRun: vi.fn(),
  mockSqlitePrepare: vi.fn(),
  mockGetAuthSession: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockCheckRateLimit: vi.fn((): { allowed: boolean; retryAfterMs?: number } => ({ allowed: true })),
  mockLogAudit: vi.fn(),
}));

mockSqlitePrepare.mockImplementation(() => ({ run: mockSqliteRun }));

vi.mock("@/lib/db", () => ({
  sqlite: { prepare: mockSqlitePrepare },
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

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/data-management/drop-tables", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const adminSession = { id: "arl-1", tenantId: "t1", userType: "arl" as const };

describe("POST /api/data-management/drop-tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null); // permission granted
    mockSqliteRun.mockReturnValue(undefined);
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ tables: ["onboarding_sessions"] }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks DATA_MANAGEMENT_ACCESS", async () => {
    const { ApiErrors } = await import("@/lib/api-response");
    mockRequirePermission.mockResolvedValue(ApiErrors.forbidden());

    const res = await POST(makeRequest({ tables: ["onboarding_sessions"] }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 30_000 });

    const res = await POST(makeRequest({ tables: ["onboarding_sessions"] }));
    expect(res.status).toBe(429);
  });

  it("rejects an empty tables array", async () => {
    const res = await POST(makeRequest({ tables: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-array tables value", async () => {
    const res = await POST(makeRequest({ tables: "onboarding_sessions" }));
    expect(res.status).toBe(400);
  });

  // ── The critical safety property: the allowlist is the only thing standing
  // between this endpoint and an attacker (or a careless admin) dropping a
  // core table. Every one of these must hold.
  describe("allowlist enforcement", () => {
    it("drops every table on the allowlist", async () => {
      const res = await POST(makeRequest({
        tables: ["onboarding_custom_forms", "onboarding_sessions", "onboarding_submissions"],
      }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.dropped).toEqual(["onboarding_custom_forms", "onboarding_sessions", "onboarding_submissions"]);
      expect(json.skipped).toEqual([]);
      expect(mockSqliteRun).toHaveBeenCalledTimes(3);
    });

    it("refuses to drop a core table even if explicitly requested", async () => {
      const res = await POST(makeRequest({ tables: ["users", "sessions", "arls", "locations", "tenants"] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.dropped).toEqual([]);
      expect(json.skipped).toEqual(["users", "sessions", "arls", "locations", "tenants"]);
      expect(mockSqliteRun).not.toHaveBeenCalled();
    });

    it("refuses a SQL-injection-shaped table name (never reaches the query)", async () => {
      const malicious = '"; DROP TABLE users; --';
      const res = await POST(makeRequest({ tables: [malicious] }));
      const json = await res.json();

      expect(json.skipped).toEqual([malicious]);
      expect(mockSqliteRun).not.toHaveBeenCalled();
    });

    it("processes a mixed allowed/disallowed list correctly — only the allowed ones run", async () => {
      const res = await POST(makeRequest({ tables: ["onboarding_sessions", "users", "onboarding_submissions"] }));
      const json = await res.json();

      expect(json.dropped).toEqual(["onboarding_sessions", "onboarding_submissions"]);
      expect(json.skipped).toEqual(["users"]);
      expect(mockSqliteRun).toHaveBeenCalledTimes(2);
    });

    it("moves a table to skipped (not dropped) if the DROP statement itself throws", async () => {
      mockSqliteRun.mockImplementationOnce(() => {
        throw new Error("table is locked");
      });

      const res = await POST(makeRequest({ tables: ["onboarding_sessions"] }));
      const json = await res.json();

      expect(json.dropped).toEqual([]);
      expect(json.skipped).toEqual(["onboarding_sessions"]);
    });
  });

  it("writes an audit log entry recording exactly what was dropped and skipped", async () => {
    await POST(makeRequest({ tables: ["onboarding_sessions", "users"] }));

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t1",
      userId: "arl-1",
      operation: "drop_tables",
      affectedCount: 1,
      payload: { dropped: ["onboarding_sessions"], skipped: ["users"] },
      status: "success",
    }));
  });

  it("returns 500 on unexpected errors without crashing", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });

    const res = await POST(makeRequest({ tables: ["onboarding_sessions"] }));
    expect(res.status).toBe(500);
  });
});
