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
  return new Request("http://localhost/api/data-management/purge-old-tasks", { method: "POST" });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/purge-old-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetAuthSession.mockResolvedValue(adminSession);
    mockRequirePermission.mockResolvedValue(null);
    mockRun.mockReturnValue({ changes: 12 });
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

  it("scopes the delete to the caller's tenant via the completion's task", async () => {
    await POST(makeRequest());

    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toMatch(/task_id IN \(SELECT id FROM tasks WHERE tenant_id = \?\)/);
    expect(mockRun).toHaveBeenCalledWith(expect.any(String), "tenant-a");
  });

  it("uses a 90-day cutoff", async () => {
    await POST(makeRequest());

    const [cutoffArg] = mockRun.mock.calls[0];
    const cutoff = new Date(cutoffArg as string);
    const expected = new Date();
    expected.setDate(expected.getDate() - 90);

    expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(2 * 24 * 60 * 60 * 1000);
  });

  it("returns the deleted count and logs the audit entry", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedCompletions).toBe(12);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "purge", entityType: "task_completions" }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
