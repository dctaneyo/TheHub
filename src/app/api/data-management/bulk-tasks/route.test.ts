import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRun, mockPrepare, mockTransaction, mockGetAuthSession, mockRequirePermission, mockCheckRateLimit, mockLogBulkOperation, mockRefreshTaskTimers } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetAuthSession: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockCheckRateLimit: vi.fn((): { allowed: boolean; retryAfterMs?: number } => ({ allowed: true })),
  mockLogBulkOperation: vi.fn(),
  mockRefreshTaskTimers: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ run: mockRun }));
// better-sqlite3's db.transaction(fn) returns a callable wrapper —
// simulate it by just invoking the wrapped function directly.
mockTransaction.mockImplementation((fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => fn(...args));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare, transaction: mockTransaction } }));
vi.mock("@/lib/api-helpers", () => ({ getAuthSession: mockGetAuthSession, requirePermission: mockRequirePermission }));
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit, getClientIP: vi.fn(() => "192.168.1.1") }));
vi.mock("@/lib/audit-logger", () => ({ logBulkOperation: mockLogBulkOperation }));
vi.mock("@/lib/task-notification-scheduler", () => ({ refreshTaskTimers: mockRefreshTaskTimers }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "new-task-id") }));

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/data-management/bulk-tasks", { method: "POST", body: JSON.stringify(body) });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/bulk-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 3 });
  });

  it("returns 401 when there's no session", async () => {
    mockGetAuthSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "clear-completions-today" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks DATA_MANAGEMENT_ACCESS", async () => {
    const { ApiErrors } = await import("@/lib/api-response");
    mockRequirePermission.mockResolvedValue(ApiErrors.forbidden());
    const res = await POST(makeRequest({ action: "clear-completions-today" }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await POST(makeRequest({ action: "clear-completions-today" }));
    expect(res.status).toBe(429);
  });

  it("rejects an unrecognized action", async () => {
    const res = await POST(makeRequest({ action: "nuke-everything" }));
    expect(res.status).toBe(400);
  });

  describe("clear-completions-today / -week / -all-completions", () => {
    it.each(["clear-completions-today", "clear-completions-week", "clear-all-completions"])(
      "%s scopes the delete to this tenant's own tasks",
      async (action) => {
        await POST(makeRequest({ action }));
        const sql = mockPrepare.mock.calls[0][0] as string;
        expect(sql).toMatch(/task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/);
        expect(mockRun.mock.calls[0].at(-1)).toBe("tenant-a");
      }
    );
  });

  describe("create-tasks-bulk", () => {
    it("requires a non-empty tasks array", async () => {
      const res = await POST(makeRequest({ action: "create-tasks-bulk", payload: { tasks: [] } }));
      expect(res.status).toBe(400);
    });

    it("inserts every task with this tenant's id, not the column default", async () => {
      const tasks = [{ title: "Wipe counters" }, { title: "Restock" }];
      const res = await POST(makeRequest({ action: "create-tasks-bulk", payload: { tasks } }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.created).toBe(2);

      const insertSql = mockPrepare.mock.calls[0][0] as string;
      expect(insertSql).toContain("tenant_id");

      // tenantId is the 2nd bound param (after the generated id) on every insert call
      expect(mockRun).toHaveBeenCalledTimes(2);
      for (const call of mockRun.mock.calls) {
        expect(call[1]).toBe("tenant-a");
      }
    });
  });

  describe("delete-tasks-bulk", () => {
    it("requires a non-empty taskIds array", async () => {
      const res = await POST(makeRequest({ action: "delete-tasks-bulk", payload: { taskIds: [] } }));
      expect(res.status).toBe(400);
    });

    it("scopes both the completions delete and the tasks delete to this tenant", async () => {
      await POST(makeRequest({ action: "delete-tasks-bulk", payload: { taskIds: ["t1", "t2"] } }));

      const calls = mockPrepare.mock.calls.map((c) => c[0] as string);
      expect(calls[0]).toMatch(/task_id IN \(\?,\?\) AND task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/);
      expect(calls[1]).toMatch(/DELETE FROM tasks WHERE id IN \(\?,\?\) AND tenant_id = \?/);
      // a task ID belonging to another tenant is included in the IN-list but
      // the trailing "AND tenant_id = ?" is what actually excludes it
      expect(mockRun.mock.calls[1]).toEqual(["t1", "t2", "tenant-a"]);
    });
  });

  describe("update-tasks-bulk", () => {
    it("requires taskIds and updates", async () => {
      const res = await POST(makeRequest({ action: "update-tasks-bulk", payload: { taskIds: ["t1"] } }));
      expect(res.status).toBe(400);
    });

    it("rejects an update payload with no recognized fields", async () => {
      const res = await POST(makeRequest({ action: "update-tasks-bulk", payload: { taskIds: ["t1"], updates: { unknownField: 1 } } }));
      expect(res.status).toBe(400);
    });

    it("scopes the update to this tenant's own tasks", async () => {
      await POST(makeRequest({ action: "update-tasks-bulk", payload: { taskIds: ["t1", "t2"], updates: { priority: "high" } } }));

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toMatch(/WHERE id IN \(\?,\?\) AND tenant_id = \?/);
      expect(mockRun.mock.calls[0]).toEqual(["high", expect.any(String), "t1", "t2", "tenant-a"]);
    });
  });

  it("refreshes task timers and logs the bulk operation after a successful action", async () => {
    await POST(makeRequest({ action: "clear-completions-today" }));

    expect(mockRefreshTaskTimers).toHaveBeenCalled();
    expect(mockLogBulkOperation).toHaveBeenCalledWith(expect.objectContaining({ userId: "arl-1", operation: "clear-completions-today", entityType: "tasks" }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest({ action: "clear-completions-today" }));
    expect(res.status).toBe(500);
  });
});
