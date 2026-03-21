import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing the route
const mockDbGet = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbGet,
        })),
      })),
    })),
  },
  schema: {
    orgIpMappings: {
      tenantId: "tenant_id",
      ipAddress: "ip_address",
    },
    tenants: {
      id: "id",
      slug: "slug",
      name: "name",
      logoUrl: "logo_url",
      primaryColor: "primary_color",
      accentColor: "accent_color",
      faviconUrl: "favicon_url",
      appTitle: "app_title",
      isActive: "is_active",
    },
  },
}));

vi.mock("@/lib/rate-limiter", () => ({
  getClientIP: vi.fn(() => "192.168.1.100"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

import { GET } from "./route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/resolve-org-by-ip", {
    method: "GET",
  });
}

describe("GET /api/auth/resolve-org-by-ip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { ok: false } when no IP mapping exists", async () => {
    mockDbGet.mockReturnValueOnce(undefined);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: false });
  });

  it("returns tenant branding when IP mapping exists and tenant is active", async () => {
    // First call: orgIpMappings lookup
    mockDbGet.mockReturnValueOnce({ tenantId: "t1" });
    // Second call: tenants lookup
    mockDbGet.mockReturnValueOnce({
      id: "t1",
      slug: "kazi",
      name: "Kazi Corp",
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
      faviconUrl: null,
      appTitle: "Kazi Hub",
      isActive: true,
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tenant).toEqual({
      id: "t1",
      slug: "kazi",
      name: "Kazi Corp",
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
      faviconUrl: null,
      appTitle: "Kazi Hub",
    });
  });

  it("returns { ok: false } when IP mapping exists but tenant is inactive", async () => {
    mockDbGet.mockReturnValueOnce({ tenantId: "t1" });
    mockDbGet.mockReturnValueOnce({
      id: "t1",
      slug: "kazi",
      name: "Kazi Corp",
      logoUrl: null,
      primaryColor: "#000",
      accentColor: null,
      faviconUrl: null,
      appTitle: null,
      isActive: false,
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: false });
  });

  it("returns { ok: false } when IP mapping exists but tenant not found", async () => {
    mockDbGet.mockReturnValueOnce({ tenantId: "t-gone" });
    mockDbGet.mockReturnValueOnce(undefined);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: false });
  });

  it("does not include isActive in the tenant response", async () => {
    mockDbGet.mockReturnValueOnce({ tenantId: "t1" });
    mockDbGet.mockReturnValueOnce({
      id: "t1",
      slug: "kazi",
      name: "Kazi Corp",
      logoUrl: null,
      primaryColor: "#000",
      accentColor: null,
      faviconUrl: null,
      appTitle: null,
      isActive: true,
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.tenant).not.toHaveProperty("isActive");
  });

  it("returns { ok: false } on unexpected errors", async () => {
    mockDbGet.mockImplementationOnce(() => {
      throw new Error("DB connection failed");
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: false });
  });
});
