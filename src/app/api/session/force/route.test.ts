import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGet, mockAll, mockRun, mockSqliteRun, mockGetSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockAll: vi.fn((): unknown[] => []),
  mockRun: vi.fn(),
  mockSqliteRun: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
          all: mockAll,
          orderBy: vi.fn(() => ({ all: mockAll })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: mockRun,
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockRun,
      })),
    })),
  },
  schema: {
    sessions: { id: "id", isOnline: "is_online", lastSeen: "last_seen" },
    locations: { id: "id", tenantId: "tenant_id" },
    arls: { id: "id", tenantId: "tenant_id" },
  },
  sqlite: {
    prepare: vi.fn(() => ({ run: mockSqliteRun })),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((...args: unknown[]) => args),
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "uuid-1") }));

vi.mock("@/lib/auth", () => ({
  getSession: mockGetSession,
  signToken: vi.fn(() => "signed-token"),
  getTokenExpiry: vi.fn(() => "2026-12-31T00:00:00.000Z"),
}));

vi.mock("@/lib/socket-emit", () => ({
  broadcastForceLogout: vi.fn(),
  broadcastForceRedirect: vi.fn(),
  broadcastPresenceUpdate: vi.fn(),
  broadcastSessionUpdated: vi.fn(),
}));

vi.mock("@/lib/socket-server", () => ({
  setPendingForceAction: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIP: vi.fn(() => "192.168.1.1"),
}));

vi.mock("@/lib/audit-logger", () => ({
  logAudit: vi.fn(),
}));

import { GET, POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/session/force", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const arlSession = { id: "arl-1", tenantId: "t1", userType: "arl" as const };

describe("GET /api/session/force", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(arlSession);
    mockAll.mockReturnValue([]);
  });

  it("rejects non-ARL callers", async () => {
    mockGetSession.mockResolvedValue({ id: "loc-1", tenantId: "t1", userType: "location" });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("marks stale sessions offline before listing", async () => {
    await GET();
    expect(mockSqliteRun).toHaveBeenCalled();
  });

  it("enriches location sessions with the location's name and store number", async () => {
    mockAll.mockReturnValue([
      { id: "s1", sessionCode: "123456", userType: "location", userId: "l1", deviceType: "kiosk", lastSeen: "now", createdAt: "then" },
    ]);
    mockGet.mockReturnValueOnce({ name: "Store 1", storeNumber: "42" });

    const res = await GET();
    const json = await res.json();

    expect(json.activeSessions[0].name).toBe("Store 1");
    expect(json.activeSessions[0].storeNumber).toBe("42");
  });

  it("enriches ARL sessions with the ARL's name", async () => {
    mockAll.mockReturnValue([
      { id: "s2", sessionCode: "654321", userType: "arl", userId: "a1", deviceType: "desktop", lastSeen: "now", createdAt: "then" },
    ]);
    mockGet.mockReturnValueOnce({ name: "Jane" });

    const res = await GET();
    const json = await res.json();

    expect(json.activeSessions[0].name).toBe("Jane");
    expect(json.activeSessions[0].storeNumber).toBeNull();
  });

  it("falls back to 'Unknown' when the underlying user record is gone", async () => {
    mockAll.mockReturnValue([
      { id: "s3", sessionCode: "111111", userType: "location", userId: "l-gone", deviceType: "kiosk", lastSeen: "now", createdAt: "then" },
    ]);
    mockGet.mockReturnValueOnce(undefined);

    const res = await GET();
    const json = await res.json();

    expect(json.activeSessions[0].name).toBe("Unknown");
  });

  it("returns 500 on unexpected errors", async () => {
    mockAll.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/session/force", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(arlSession);
  });

  it("rejects non-ARL callers", async () => {
    mockGetSession.mockResolvedValue({ id: "loc-1", tenantId: "t1", userType: "location" });

    const res = await POST(makeRequest({ action: "logout", sessionId: "s1" }));
    expect(res.status).toBe(403);
  });

  it("requires action and sessionId", async () => {
    const res = await POST(makeRequest({ action: "logout" }));
    expect(res.status).toBe(400);
  });

  it("404s when the target session doesn't exist", async () => {
    mockGet.mockReturnValueOnce(undefined);

    const res = await POST(makeRequest({ action: "logout", sessionId: "gone" }));
    expect(res.status).toBe(404);
  });

  it("rejects an unrecognized action", async () => {
    mockGet.mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location" });

    const res = await POST(makeRequest({ action: "explode", sessionId: "s1" }));
    expect(res.status).toBe(400);
  });

  describe("action=logout", () => {
    it("deletes the session and returns success", async () => {
      mockGet.mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location" });

      const res = await POST(makeRequest({ action: "logout", sessionId: "s1" }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.action).toBe("logout");
      expect(mockRun).toHaveBeenCalledTimes(1); // the delete
    });

    it("still deletes the session even if it has no token to flag for heartbeat fallback", async () => {
      mockGet.mockReturnValueOnce({ id: "s1", token: null, userId: "u1", userType: "location" });

      const res = await POST(makeRequest({ action: "logout", sessionId: "s1" }));
      expect(res.status).toBe(200);
    });
  });

  describe("action=reassign", () => {
    it("requires assignToType and assignToId", async () => {
      mockGet.mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location" });

      const res = await POST(makeRequest({ action: "reassign", sessionId: "s1" }));
      expect(res.status).toBe(400);
    });

    it("rejects an assignToType outside location/arl", async () => {
      mockGet.mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location" });

      const res = await POST(makeRequest({ action: "reassign", sessionId: "s1", assignToType: "guest", assignToId: "x" }));
      expect(res.status).toBe(400);
    });

    it("404s when the reassignment target location isn't found", async () => {
      mockGet
        .mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location" }) // target session
        .mockReturnValueOnce(undefined); // location lookup

      const res = await POST(makeRequest({ action: "reassign", sessionId: "s1", assignToType: "location", assignToId: "l1" }));
      expect(res.status).toBe(404);
    });

    it("rejects a deactivated reassignment target", async () => {
      mockGet
        .mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location" })
        .mockReturnValueOnce({ id: "l1", tenantId: "t1", isActive: false, name: "Store 1" });

      const res = await POST(makeRequest({ action: "reassign", sessionId: "s1", assignToType: "location", assignToId: "l1" }));
      expect(res.status).toBe(403);
    });

    it("reassigns to a location: deletes the old session, creates a new one, returns redirectTo /dashboard", async () => {
      mockGet
        .mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location", deviceType: "kiosk" })
        .mockReturnValueOnce({ id: "l1", tenantId: "t1", isActive: true, name: "Store 1", userId: "1234", storeNumber: "1" });

      const res = await POST(makeRequest({ action: "reassign", sessionId: "s1", assignToType: "location", assignToId: "l1" }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.action).toBe("reassign");
      expect(json.redirectTo).toBe("/dashboard");
      expect(json.targetName).toBe("Store 1");
      expect(mockRun).toHaveBeenCalledTimes(2); // delete old + insert new
    });

    it("reassigns to an ARL: returns redirectTo /arl", async () => {
      mockGet
        .mockReturnValueOnce({ id: "s1", token: "tok", userId: "u1", userType: "location", deviceType: "kiosk" })
        .mockReturnValueOnce({ id: "a1", tenantId: "t1", isActive: true, name: "Jane", userId: "5678", role: "admin" });

      const res = await POST(makeRequest({ action: "reassign", sessionId: "s1", assignToType: "arl", assignToId: "a1" }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.redirectTo).toBe("/arl");
    });
  });

  it("returns 500 on unexpected errors", async () => {
    mockGet.mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });

    const res = await POST(makeRequest({ action: "logout", sessionId: "s1" }));
    expect(res.status).toBe(500);
  });
});
