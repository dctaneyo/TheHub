import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExec, mockRequireAdminSession, mockVerifyPin, mockExistsSync, mockStatSync } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockRequireAdminSession: vi.fn(),
  mockVerifyPin: vi.fn(),
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ sqlite: { exec: mockExec } }));
vi.mock("@/lib/api-helpers", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/admin-auth", () => ({ verifyAdminPinReconfirmation: mockVerifyPin }));
vi.mock("fs", () => ({ default: { existsSync: mockExistsSync, statSync: mockStatSync } }));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown> = { pin: "123456" }): Request {
  return new Request("http://localhost/api/admin/system/vacuum", { method: "POST", body: JSON.stringify(body) });
}

const adminAuth = { session: { adminId: "admin-1", email: "a@b.com", name: "Admin" } };

describe("POST /api/admin/system/vacuum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(adminAuth);
    mockVerifyPin.mockReturnValue({ ok: true });
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1000 });
  });

  it("returns the requireAdminSession response when not authorized", async () => {
    mockRequireAdminSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("requires a pin in the body", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("returns 401 when the PIN is wrong", async () => {
    mockVerifyPin.mockReturnValue({ ok: false, error: "Incorrect PIN" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("is never tenant-scoped — runs VACUUM and ANALYZE on the whole database", async () => {
    await POST(makeRequest());
    expect(mockExec).toHaveBeenCalledWith("VACUUM");
    expect(mockExec).toHaveBeenCalledWith("ANALYZE");
  });

  it("returns the size before/after/saved", async () => {
    mockStatSync.mockReturnValueOnce({ size: 1000 }).mockReturnValueOnce({ size: 800 });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.sizeBefore).toBe(1000);
    expect(json.sizeAfter).toBe(800);
    expect(json.saved).toBe(200);
  });

  it("returns 500 on unexpected errors", async () => {
    mockExec.mockImplementationOnce(() => { throw new Error("DB locked"); });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
