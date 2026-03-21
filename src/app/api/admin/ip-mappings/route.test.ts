import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetAuthSession = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  getAuthSession: () => mockGetAuthSession(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbGet,
          all: mockDbAll,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: mockDbRun,
      })),
    })),
  },
  schema: {
    orgIpMappings: {
      id: "id",
      tenantId: "tenant_id",
      ipAddress: "ip_address",
      createdBy: "created_by",
      createdAt: "created_at",
    },
    arls: {
      id: "id",
      role: "role",
      tenantId: "tenant_id",
    },
    tenants: {
      id: "id",
      isActive: "is_active",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("uuid", () => ({
  v4: () => "test-uuid-123",
}));

import { GET as _GET, POST as _POST } from "./route";
import type { NextResponse } from "next/server";

// Cast to proper types since mocks confuse TS inference
const GET = _GET as () => Promise<NextResponse>;
const POST = _POST as (req: NextRequest) => Promise<NextResponse>;

const validSession = {
  id: "arl-1",
  userType: "arl" as const,
  tenantId: "kazi",
  name: "Test ARL",
};

describe("GET /api/admin/ip-mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it("returns 403 when user is not an ARL", async () => {
    mockGetAuthSession.mockResolvedValue({ ...validSession, userType: "location" });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("returns 403 when ARL not found in DB", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet.mockReturnValueOnce(undefined); // ARL lookup

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("returns mappings for the current tenant", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet.mockReturnValueOnce({ role: "admin" }); // ARL lookup
    mockDbAll.mockReturnValueOnce([
      { id: "m1", tenantId: "kazi", ipAddress: "10.0.0.1", createdBy: "arl-1", createdAt: "2024-01-01" },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.mappings).toHaveLength(1);
    expect(json.mappings[0].ipAddress).toBe("10.0.0.1");
  });
});

describe("POST /api/admin/ip-mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePostRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/admin/ip-mappings", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const res = await POST(makePostRequest({ ipAddress: "10.0.0.1" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it("returns 400 when ipAddress is missing", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet.mockReturnValueOnce({ role: "arl" }); // ARL lookup

    const res = await POST(makePostRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toContain("ipAddress");
  });

  it("returns 400 for invalid IP format", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet.mockReturnValueOnce({ role: "arl" }); // ARL lookup

    const res = await POST(makePostRequest({ ipAddress: "not-an-ip" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toContain("Invalid IP");
  });

  it("returns 400 for IP with octets > 255", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet.mockReturnValueOnce({ role: "arl" }); // ARL lookup

    const res = await POST(makePostRequest({ ipAddress: "999.999.999.999" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toContain("Invalid IP");
  });

  it("creates a mapping for a valid IPv4 address", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet
      .mockReturnValueOnce({ role: "admin" })  // ARL lookup
      .mockReturnValueOnce({ id: "kazi", isActive: true }) // tenant lookup
      .mockReturnValueOnce(undefined); // duplicate check

    const res = await POST(makePostRequest({ ipAddress: "192.168.1.50" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.id).toBe("test-uuid-123");
    expect(mockDbRun).toHaveBeenCalled();
  });

  it("returns 400 when IP is already mapped", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet
      .mockReturnValueOnce({ role: "admin" })  // ARL lookup
      .mockReturnValueOnce({ id: "kazi", isActive: true }) // tenant lookup
      .mockReturnValueOnce({ id: "existing-mapping" }); // duplicate check

    const res = await POST(makePostRequest({ ipAddress: "192.168.1.50" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toContain("already mapped");
  });

  it("returns 400 when tenant is inactive", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet
      .mockReturnValueOnce({ role: "admin" })  // ARL lookup
      .mockReturnValueOnce({ id: "kazi", isActive: false }); // tenant lookup

    const res = await POST(makePostRequest({ ipAddress: "10.0.0.1", tenantId: "kazi" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toContain("not found or inactive");
  });
});
