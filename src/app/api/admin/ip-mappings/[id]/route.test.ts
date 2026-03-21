import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthSession = vi.fn();
const mockDbGet = vi.fn();
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
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockDbRun,
      })),
    })),
  },
  schema: {
    orgIpMappings: {
      id: "id",
      tenantId: "tenant_id",
    },
    arls: {
      id: "id",
      role: "role",
      tenantId: "tenant_id",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

import { DELETE } from "./route";

const validSession = {
  id: "arl-1",
  userType: "arl" as const,
  tenantId: "kazi",
  name: "Test ARL",
};

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/admin/ip-mappings/m1", {
    method: "DELETE",
  });
}

describe("DELETE /api/admin/ip-mappings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: "m1" }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it("returns 403 when user is not an ARL", async () => {
    mockGetAuthSession.mockResolvedValue({ ...validSession, userType: "location" });

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: "m1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("returns 404 when mapping does not exist", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet
      .mockReturnValueOnce({ role: "admin" }) // ARL lookup
      .mockReturnValueOnce(undefined); // mapping lookup

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: "m1" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it("returns 403 when mapping belongs to another tenant", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet
      .mockReturnValueOnce({ role: "admin" }) // ARL lookup
      .mockReturnValueOnce({ id: "m1", tenantId: "other-tenant" }); // mapping lookup

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: "m1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it("deletes the mapping when it belongs to the current tenant", async () => {
    mockGetAuthSession.mockResolvedValue(validSession);
    mockDbGet
      .mockReturnValueOnce({ role: "admin" }) // ARL lookup
      .mockReturnValueOnce({ id: "m1", tenantId: "kazi" }); // mapping lookup

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: "m1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalled();
  });
});
