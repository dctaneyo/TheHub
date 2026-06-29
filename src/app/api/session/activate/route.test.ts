import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGet, mockRun, mockGetSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: mockRun,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: mockRun,
        })),
      })),
    })),
  },
  schema: {
    pendingSessions: { id: "id" },
    locations: { id: "id", tenantId: "tenant_id" },
    arls: { id: "id", tenantId: "tenant_id" },
    sessions: {},
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "uuid-1") }));

vi.mock("@/lib/auth", () => ({
  getSession: mockGetSession,
  signToken: vi.fn(() => "signed-token"),
  getTokenExpiry: vi.fn(() => "2026-12-31T00:00:00.000Z"),
}));

vi.mock("@/lib/socket-emit", () => ({
  broadcastSessionActivated: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIP: vi.fn(() => "192.168.1.1"),
}));

import { POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/session/activate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const arlSession = { id: "arl-1", tenantId: "t1", userType: "arl" as const };

describe("POST /api/session/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(arlSession);
  });

  it("rejects non-ARL callers", async () => {
    mockGetSession.mockResolvedValue({ id: "loc-1", tenantId: "t1", userType: "location" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(403);
  });

  it("rejects when no session at all", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(403);
  });

  it("requires pendingId, assignToType, and assignToId", async () => {
    const res = await POST(makeRequest({ pendingId: "p1" }));
    expect(res.status).toBe(400);
  });

  it("rejects an assignToType outside location/arl", async () => {
    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "guest", assignToId: "x" }));
    expect(res.status).toBe(400);
  });

  it("404s when the pending session doesn't exist", async () => {
    mockGet.mockReturnValueOnce(undefined); // pendingSessions lookup

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(404);
  });

  it("rejects a pending session that's already activated", async () => {
    mockGet.mockReturnValueOnce({ id: "p1", status: "activated", expiresAt: "2099-01-01T00:00:00Z" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(400);
  });

  it("rejects an expired pending session", async () => {
    mockGet.mockReturnValueOnce({ id: "p1", status: "pending", expiresAt: "2000-01-01T00:00:00Z" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(400);
  });

  it("404s when the target location isn't found (or belongs to another tenant)", async () => {
    mockGet
      .mockReturnValueOnce({ id: "p1", status: "pending", expiresAt: "2099-01-01T00:00:00Z" })
      .mockReturnValueOnce(undefined); // locations lookup, scoped by tenantId — cross-tenant lookups resolve to undefined

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(404);
  });

  it("rejects a deactivated location", async () => {
    mockGet
      .mockReturnValueOnce({ id: "p1", status: "pending", expiresAt: "2099-01-01T00:00:00Z" })
      .mockReturnValueOnce({ id: "l1", tenantId: "t1", isActive: false, name: "Store 1" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(403);
  });

  it("activates a pending session onto a location and returns redirectTo /dashboard", async () => {
    mockGet
      .mockReturnValueOnce({ id: "p1", status: "pending", expiresAt: "2099-01-01T00:00:00Z" })
      .mockReturnValueOnce({ id: "l1", tenantId: "t1", isActive: true, name: "Store 1", userId: "1234", storeNumber: "1" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.redirectTo).toBe("/dashboard");
    expect(json.targetName).toBe("Store 1");
    // one insert (session record) + one update (pending session) = 2 run() calls
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it("rejects a deactivated ARL account", async () => {
    mockGet
      .mockReturnValueOnce({ id: "p1", status: "pending", expiresAt: "2099-01-01T00:00:00Z" })
      .mockReturnValueOnce({ id: "a1", tenantId: "t1", isActive: false, name: "Jane" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "arl", assignToId: "a1" }));
    expect(res.status).toBe(403);
  });

  it("activates a pending session onto an ARL and returns redirectTo /arl", async () => {
    mockGet
      .mockReturnValueOnce({ id: "p1", status: "pending", expiresAt: "2099-01-01T00:00:00Z" })
      .mockReturnValueOnce({ id: "a1", tenantId: "t1", isActive: true, name: "Jane", userId: "5678", role: "admin" });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "arl", assignToId: "a1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.redirectTo).toBe("/arl");
    expect(json.targetName).toBe("Jane");
  });

  it("returns 500 on unexpected errors", async () => {
    mockGet.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });

    const res = await POST(makeRequest({ pendingId: "p1", assignToType: "location", assignToId: "l1" }));
    expect(res.status).toBe(500);
  });
});
