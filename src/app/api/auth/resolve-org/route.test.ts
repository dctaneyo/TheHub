import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing the route
vi.mock("@/lib/tenant", () => ({
  resolveTenantBySlug: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
}));

import { POST } from "./route";
import { resolveTenantBySlug } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limiter";

const mockResolveTenant = vi.mocked(resolveTenantBySlug);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/resolve-org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/resolve-org", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9 });
  });

  it("returns tenant branding for a valid slug", async () => {
    const tenant = {
      id: "t1",
      slug: "kazi",
      name: "Kazi Corp",
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
      faviconUrl: null,
      appTitle: "Kazi Hub",
      isActive: true,
    };
    mockResolveTenant.mockReturnValue(tenant);

    const res = await POST(makeRequest({ slug: "KAZI" }));
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

  it("returns 404 when tenant is not found", async () => {
    mockResolveTenant.mockReturnValue(null);

    const res = await POST(makeRequest({ slug: "NOPE" }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it("returns 400 for slug shorter than 2 characters", async () => {
    const res = await POST(makeRequest({ slug: "A" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(mockResolveTenant).not.toHaveBeenCalled();
  });

  it("returns 400 for slug longer than 10 characters", async () => {
    const res = await POST(makeRequest({ slug: "ABCDEFGHIJK" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(mockResolveTenant).not.toHaveBeenCalled();
  });

  it("returns 400 for empty slug", async () => {
    const res = await POST(makeRequest({ slug: "" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("returns 400 for missing slug", async () => {
    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("returns 400 for slug with special characters", async () => {
    const res = await POST(makeRequest({ slug: "KA-ZI" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    const res = await POST(makeRequest({ slug: "KAZI" }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.ok).toBe(false);
    expect(mockResolveTenant).not.toHaveBeenCalled();
  });

  it("does not include isActive in the response", async () => {
    mockResolveTenant.mockReturnValue({
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

    const res = await POST(makeRequest({ slug: "KAZI" }));
    const json = await res.json();

    expect(json.tenant).not.toHaveProperty("isActive");
  });
});
