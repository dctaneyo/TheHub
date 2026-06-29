import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockRun, mockPrepare, mockExec, mockGetAuthSession, mockRequirePermission, mockCheckRateLimit, mockLogAudit } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockExec: vi.fn(),
  mockGetAuthSession: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockCheckRateLimit: vi.fn((): { allowed: boolean; retryAfterMs?: number } => ({ allowed: true })),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ get: mockGet, run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare, exec: mockExec } }));
vi.mock("@/lib/api-helpers", () => ({ getAuthSession: mockGetAuthSession, requirePermission: mockRequirePermission }));
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit, getClientIP: vi.fn(() => "192.168.1.1") }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));

import { GET, POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/data-management/archive-old-data", { method: "POST", body: JSON.stringify(body) });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/archive-old-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 9 });
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ dataType: "messages" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks DATA_MANAGEMENT_ACCESS", async () => {
    const { ApiErrors } = await import("@/lib/api-response");
    mockRequirePermission.mockResolvedValue(ApiErrors.forbidden());
    const res = await POST(makeRequest({ dataType: "messages" }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await POST(makeRequest({ dataType: "messages" }));
    expect(res.status).toBe(429);
  });

  it("rejects an unrecognized dataType", async () => {
    const res = await POST(makeRequest({ dataType: "everything" }));
    expect(res.status).toBe(400);
  });

  it("dataType=messages: scopes both the archive-insert and the delete to this tenant's conversations", async () => {
    await POST(makeRequest({ dataType: "messages" }));

    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const insertSql = sqlCalls.find((s) => s.includes("INSERT INTO archived_messages"))!;
    const deleteSql = sqlCalls.find((s) => s.includes("DELETE FROM messages"))!;

    expect(insertSql).toMatch(/conversation_id IN \(SELECT id FROM conversations WHERE tenant_id = \?\)/);
    expect(insertSql).toContain("? as tenant_id");
    expect(deleteSql).toMatch(/conversation_id IN \(SELECT id FROM conversations WHERE tenant_id = \?\)/);
  });

  it("dataType=task-completions: scopes both the archive-insert and the delete to this tenant's tasks", async () => {
    await POST(makeRequest({ dataType: "task-completions" }));

    const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const insertSql = sqlCalls.find((s) => s.includes("INSERT INTO archived_task_completions"))!;
    const deleteSql = sqlCalls.find((s) => s.includes("DELETE FROM task_completions"))!;

    expect(insertSql).toMatch(/task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/);
    expect(deleteSql).toMatch(/task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/);
  });

  it("adds the tenant_id column to pre-existing archive tables, tolerating it already existing", async () => {
    mockExec.mockImplementation((sql: string) => {
      if (sql.includes("ALTER TABLE")) throw new Error("duplicate column name: tenant_id");
    });

    const res = await POST(makeRequest({ dataType: "messages" }));
    expect(res.status).toBe(200); // doesn't bubble up the harmless ALTER TABLE failure
  });

  it("respects a custom daysOld cutoff", async () => {
    const json = await (await POST(makeRequest({ dataType: "messages", daysOld: 30 }))).json();
    const cutoff = new Date(json.cutoffDate);
    const expected = new Date();
    expected.setDate(expected.getDate() - 30);
    expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(2000);
  });

  it("returns the archived count and logs the audit entry", async () => {
    const res = await POST(makeRequest({ dataType: "messages" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.archived).toBe(9);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "archive", entityType: "messages" }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest({ dataType: "messages" }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/data-management/archive-old-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockGet.mockReturnValue({ c: 7 });
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("scopes both stat counts to this tenant", async () => {
    await GET();

    const calls = mockPrepare.mock.calls.map((c) => c[0] as string);
    expect(calls).toHaveLength(2);
    for (const sql of calls) expect(sql).toMatch(/WHERE tenant_id = \?/);
    expect(mockGet).toHaveBeenCalledWith("tenant-a");
  });

  it("returns the totals", async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.archivedMessages).toBe(7);
    expect(json.archivedCompletions).toBe(7);
    expect(json.total).toBe(14);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
