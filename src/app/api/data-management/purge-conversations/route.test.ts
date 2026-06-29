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

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ getAuthSession: mockGetAuthSession, requirePermission: mockRequirePermission }));
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit, getClientIP: vi.fn(() => "192.168.1.1") }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "new-global-id") }));

import { POST } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost/api/data-management/purge-conversations", { method: "POST" });
}

const adminSession = { id: "arl-1", tenantId: "tenant-a", userType: "arl" as const };

describe("POST /api/data-management/purge-conversations", () => {
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

  it("looks up this tenant's own global conversation, not any tenant's", async () => {
    mockGet.mockReturnValueOnce({ id: "global-a" }).mockReturnValueOnce({ id: "global-a" });

    await POST(makeRequest());

    const getCalls = mockPrepare.mock.calls.filter((c) => (c[0] as string).includes("SELECT id FROM conversations WHERE type = 'global'"));
    for (const call of getCalls) {
      expect(call[0]).toMatch(/AND tenant_id = \?/);
    }
  });

  it("preserves the global conversation while deleting everything else, all scoped to this tenant", async () => {
    mockGet.mockReturnValueOnce({ id: "global-a" }).mockReturnValueOnce({ id: "global-a" });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.globalConversationPreserved).toBe(true);

    const deleteCalls = mockPrepare.mock.calls.filter((c) => (c[0] as string).startsWith("DELETE"));
    for (const call of deleteCalls) {
      expect(call[0]).toMatch(/tenant_id = \?/);
    }
  });

  it("creates a new global conversation for this tenant if it was deleted somehow", async () => {
    mockGet.mockReturnValueOnce({ id: "global-a" }).mockReturnValueOnce(undefined); // gone after purge

    await POST(makeRequest());

    const insertCall = mockPrepare.mock.calls.find((c) => (c[0] as string).includes("INSERT INTO conversations"));
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain("tenant_id");
    expect(mockRun).toHaveBeenCalledWith("new-global-id", "tenant-a", expect.any(String));
  });

  it("falls back to deleting all of this tenant's conversations if it had no global conversation at all", async () => {
    mockGet.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

    await POST(makeRequest());

    const convoDelete = mockPrepare.mock.calls.find((c) => (c[0] as string).startsWith("DELETE FROM conversations"));
    expect(convoDelete![0]).not.toContain("!=");
    expect(convoDelete![0]).toMatch(/tenant_id = \?/);
  });

  it("logs the audit entry with this tenant's id", async () => {
    mockGet.mockReturnValueOnce({ id: "global-a" }).mockReturnValueOnce({ id: "global-a" });

    await POST(makeRequest());

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", operation: "purge", entityType: "conversations" }));
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthSession.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
