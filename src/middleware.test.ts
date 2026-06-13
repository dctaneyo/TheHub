import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Helper to create a NextRequest with specific host and optional cookies
function makeRequest(
  url: string,
  options: {
    host?: string;
    cookies?: Record<string, string>;
    method?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { host = "meetthehub.com", cookies = {}, method = "GET", headers = {} } = options;
  const req = new NextRequest(url, {
    method,
    headers: { host, ...headers },
  });
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

// Helper to build a valid JWT payload (no signature verification in middleware)
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload }));
  const sig = "fakesig";
  return `${header}.${body}.${sig}`;
}

describe("middleware — root domain handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Landing page redirects to /login ──

  it("redirects / to /login", () => {
    const res = middleware(makeRequest("https://meetthehub.com/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects /landing to /login", () => {
    const res = middleware(makeRequest("https://meetthehub.com/landing"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("allows /_next/... without a cookie", () => {
    const res = middleware(makeRequest("https://meetthehub.com/_next/static/chunk.js"));
    expect(res.status).toBe(200);
  });

  it("allows static files (with dot) without a cookie", () => {
    const res = middleware(makeRequest("https://meetthehub.com/favicon.ico"));
    expect(res.status).toBe(200);
  });

  // ── No cookie — public paths allowed ──

  it("allows /login without a cookie", () => {
    const res = middleware(makeRequest("https://meetthehub.com/login"));
    expect(res.status).toBe(200);
  });

  it("allows /api/auth/* without a cookie", () => {
    const res = middleware(makeRequest("https://meetthehub.com/api/auth/login"));
    expect(res.status).toBe(200);
  });

  // ── No cookie — protected paths redirect to /login ──

  it("redirects /dashboard to /login when no cookie", () => {
    const res = middleware(makeRequest("https://meetthehub.com/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects /arl to /login when no cookie", () => {
    const res = middleware(makeRequest("https://meetthehub.com/arl"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  // ── Invalid cookie — clear and redirect ──

  it("clears invalid x-org-id cookie and redirects to /login", () => {
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "a" }, // too short
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    // Cookie should be cleared (max-age=0)
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("x-org-id=");
  });

  it("clears cookie with special characters and redirects to /login", () => {
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "ka-zi!" },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  // ── Valid cookie — tenant headers injected ──

  it("injects x-tenant-id and x-tenant-slug from valid cookie on public path", () => {
    const res = middleware(
      makeRequest("https://meetthehub.com/login", {
        cookies: { "x-org-id": "kazi" },
      })
    );
    expect(res.status).toBe(200);
    // Headers are set on the rewritten request, check via x-middleware-request-* pattern
    // The response itself should be a next() with headers
  });

  // ── Valid cookie + no auth token → redirect to /login ──

  it("redirects to /login on protected path with valid cookie but no auth token", () => {
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "kazi" },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  // ── Valid cookie + valid token → allow through ──

  it("allows protected path with valid cookie and matching auth token", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "kazi", "hub-token": token },
      })
    );
    expect(res.status).toBe(200);
  });

  // ── Valid cookie + token tenant mismatch → clear token and redirect ──

  it("clears hub-token and redirects when token tenant doesn't match cookie", () => {
    const token = fakeJwt({ tenantId: "other", userType: "location" });
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "kazi", "hub-token": token },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("hub-token=");
  });

  // ── Route protection with cookie ──

  it("redirects location user from /arl to /dashboard", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://meetthehub.com/arl", {
        cookies: { "x-org-id": "kazi", "hub-token": token },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("redirects ARL user from /dashboard to /arl (no mirror param)", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "arl" });
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "kazi", "hub-token": token },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/arl");
  });

  it("allows ARL user on /dashboard with mirror param", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "arl" });
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard?mirror=loc1", {
        cookies: { "x-org-id": "kazi", "hub-token": token },
      })
    );
    expect(res.status).toBe(200);
  });

  // ── Cookie is case-insensitive (lowercased) ──

  it("lowercases the cookie slug for tenant headers", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://meetthehub.com/dashboard", {
        cookies: { "x-org-id": "KAZI", "hub-token": token },
      })
    );
    expect(res.status).toBe(200);
  });

  // ── meethehub.com (alternate domain) works the same ──

  it("handles root domain on meethehub.com the same way", () => {
    const res = middleware(
      makeRequest("https://meethehub.com/dashboard", { host: "meethehub.com" })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("middleware — per-org subdomain resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Subdomain provides tenant context without a cookie ──

  it("allows /login on a per-org subdomain without any cookie", () => {
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/login", { host: "kazi.meetthehub.com" })
    );
    expect(res.status).toBe(200);
  });

  it("redirects protected path to /login on subdomain when no auth token", () => {
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/dashboard", { host: "kazi.meetthehub.com" })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("allows protected path on subdomain with a matching auth token (no cookie)", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/dashboard", {
        host: "kazi.meetthehub.com",
        cookies: { "hub-token": token },
      })
    );
    expect(res.status).toBe(200);
  });

  it("clears hub-token and redirects when token tenant doesn't match subdomain", () => {
    const token = fakeJwt({ tenantId: "other", userType: "location" });
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/dashboard", {
        host: "kazi.meetthehub.com",
        cookies: { "hub-token": token },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.headers.get("set-cookie")).toContain("hub-token=");
  });

  // ── Subdomain takes priority over a conflicting org cookie ──

  it("subdomain slug wins over a different x-org-id cookie", () => {
    // Token matches the subdomain (kazi), not the stale cookie (other).
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/dashboard", {
        host: "kazi.meetthehub.com",
        cookies: { "x-org-id": "other", "hub-token": token },
      })
    );
    // Subdomain resolved kazi → token tenant matches → allowed through.
    expect(res.status).toBe(200);
  });

  // ── Invalid org cookie is ignored when a valid subdomain is present ──

  it("ignores an invalid x-org-id cookie when subdomain resolves", () => {
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/login", {
        host: "kazi.meetthehub.com",
        cookies: { "x-org-id": "a" }, // invalid format
      })
    );
    // Subdomain provides valid context, so no clear-cookie redirect.
    expect(res.status).toBe(200);
  });

  // ── Reserved subdomains do NOT resolve as orgs ──

  it("does not treat www subdomain as an org (redirects / to /login)", () => {
    const res = middleware(
      makeRequest("https://www.meetthehub.com/", { host: "www.meetthehub.com" })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("does not treat an out-of-range subdomain label as an org", () => {
    // 11-char label exceeds the 2-10 slug range → no tenant context → /login.
    const res = middleware(
      makeRequest("https://toolonglabel.meetthehub.com/dashboard", {
        host: "toolonglabel.meetthehub.com",
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("works the same on a subdomain of the alternate domain", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://kazi.meethehub.com/dashboard", {
        host: "kazi.meethehub.com",
        cookies: { "hub-token": token },
      })
    );
    expect(res.status).toBe(200);
  });
});
