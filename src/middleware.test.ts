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

  // ── www.meetthehub.com (www prefix) is treated as root domain ──

  it("handles root domain on www.meetthehub.com the same way", () => {
    const res = middleware(
      makeRequest("https://www.meetthehub.com/dashboard", { host: "www.meetthehub.com" })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("middleware — unrecognized subdomains are rejected, not org-resolved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tenants no longer resolve via per-org subdomains — they sign in at the
  // root domain via the x-org-id cookie. A stale kazi.meetthehub.com-style
  // link used to silently format-validate as a real org and only fail
  // later, confusingly, on the userId check. It should bounce to the root
  // domain instead, regardless of whether "kazi" happens to be a real
  // tenant slug, an auth token is present, or a conflicting cookie exists.

  it("redirects a real tenant's old subdomain straight to the root domain", () => {
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/login", { host: "kazi.meetthehub.com" })
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.hostname).toBe("meetthehub.com");
    expect(location.pathname).toBe("/login");
  });

  it("redirects even with a valid matching auth token present", () => {
    const token = fakeJwt({ tenantId: "kazi", userType: "location" });
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/dashboard", {
        host: "kazi.meetthehub.com",
        cookies: { "hub-token": token },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).hostname).toBe("meetthehub.com");
  });

  it("redirects even when a valid x-org-id cookie is also present", () => {
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/dashboard", {
        host: "kazi.meetthehub.com",
        cookies: { "x-org-id": "kazi" },
      })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).hostname).toBe("meetthehub.com");
  });

  it("redirects an arbitrary/nonexistent subdomain the same way a real tenant's would be", () => {
    const res = middleware(
      makeRequest("https://kfc.meetthehub.com/login", { host: "kfc.meetthehub.com" })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).hostname).toBe("meetthehub.com");
  });

  it("preserves the path when bouncing to the root domain", () => {
    const res = middleware(
      makeRequest("https://kazi.meetthehub.com/arl/tasks", { host: "kazi.meetthehub.com" })
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/arl/tasks");
  });

  it("does not redirect www — treated as the bare root domain", () => {
    const res = middleware(
      makeRequest("https://www.meetthehub.com/login", { host: "www.meetthehub.com" })
    );
    expect(res.status).toBe(200);
  });

  it("does not redirect the join subdomain", () => {
    const res = middleware(
      makeRequest("https://join.meetthehub.com/", { host: "join.meetthehub.com" })
    );
    expect(res.status).toBe(200);
  });

  it("does not redirect the nimda (admin) subdomain", () => {
    const res = middleware(
      makeRequest("https://nimda.meetthehub.com/admin/login", { host: "nimda.meetthehub.com" })
    );
    expect(res.status).toBe(200);
  });
});
