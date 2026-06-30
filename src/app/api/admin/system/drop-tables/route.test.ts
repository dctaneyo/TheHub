import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRun, mockPrepare, mockRequireAdminSession, mockVerifyPin, mockLogAudit } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockPrepare: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockVerifyPin: vi.fn(),
  mockLogAudit: vi.fn(),
}));

mockPrepare.mockImplementation(() => ({ run: mockRun }));

vi.mock("@/lib/db", () => ({ sqlite: { prepare: mockPrepare } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/admin-auth", () => ({ verifyAdminPinReconfirmation: mockVerifyPin }));
vi.mock("@/lib/audit-logger", () => ({ logAudit: mockLogAudit }));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/system/drop-tables", { method: "POST", body: JSON.stringify(body) });
}

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/system/drop-tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest({ tables: ["onboarding_sessions"], pin: "123456" }));
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makeRequest({ tables: ["onboarding_sessions"] }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makeRequest({ tables: ["onboarding_sessions"], pin: "123456" }));
    expect(res.status).toBe(401);
  });

  it("rejects an empty tables array", async () => {
    const res = await POST(makeRequest({ tables: [], pin: "123456" }));
    expect(res.status).toBe(400);
  });

  // ── The actual safety property: this route only ever drops tables on a
  // hardcoded allowlist of unused onboarding tables — it's not a general
  // "drop any table" endpoint, even for an authenticated platform admin.
  it("only drops tables on the hardcoded allowlist, silently skipping anything else", async () => {
    mockRun.mockReturnValue(undefined);
    const res = await POST(makeRequest({ tables: ["onboarding_sessions", "arls", "tenants"], pin: "123456" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.dropped).toEqual(["onboarding_sessions"]);
    expect(json.skipped).toEqual(["arls", "tenants"]);
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("onboarding_sessions"));
  });

  it("logs the audit entry with the dropped/skipped lists", async () => {
    mockRun.mockReturnValue(undefined);
    const res = await POST(makeRequest({ tables: ["onboarding_custom_forms"], pin: "123456" }));
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: "admin-1", userType: "platform_admin", operation: "drop_tables",
      payload: { dropped: ["onboarding_custom_forms"], skipped: [] },
    }));
  });

  it("treats a drop failure as a skip rather than a 500", async () => {
    mockRun.mockImplementationOnce(() => { throw new Error("locked"); });
    const res = await POST(makeRequest({ tables: ["onboarding_sessions"], pin: "123456" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.dropped).toEqual([]);
    expect(json.skipped).toEqual(["onboarding_sessions"]);
  });
});
