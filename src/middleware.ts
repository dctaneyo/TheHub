import { NextRequest, NextResponse } from "next/server";

// ── CSP Nonce Generation ──

/** Generate a cryptographically random nonce (16 bytes, base64-encoded). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Build the Content-Security-Policy header with the given nonce. */
export function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.sentry.io`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' wss: ws: https://*.meetthehub.com https://*.meethehub.com https://*.sentry.io https://*.ingest.sentry.io",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const publicPaths = ["/login", "/signup", "/api/auth/login", "/api/tenants/signup", "/meeting", "/api/meetings/join", "/api/livekit/token"];
const hubDomains = ["meetthehub.com", "meethehub.com"];
const systemSubdomains = ["join", "www", "admin"];

// Edge-compatible JWT decode (no crypto verification — cookie is httpOnly,
// full verification happens in API routes via jsonwebtoken)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract subdomain from hostname. Returns null for bare domain or system subdomains.
 */
function extractTenantSlug(hostname: string): string | null {
  const host = hostname.split(":")[0]; // strip port
  for (const domain of hubDomains) {
    if (host === domain || host === `www.${domain}`) return null; // bare / www = landing page
    if (host.endsWith(`.${domain}`)) {
      const sub = host.replace(`.${domain}`, "");
      if (systemSubdomains.includes(sub)) return null;
      return sub;
    }
  }
  return null; // unknown domain — could be custom domain, resolved server-side
}

function isRootDomain(hostname: string): boolean {
  const host = hostname.split(":")[0];
  return hubDomains.includes(host) || hubDomains.some((d) => host === `www.${d}`);
}

function isAdminDomain(hostname: string): boolean {
  const host = hostname.split(":")[0];
  return hubDomains.some((d) => host === `admin.${d}`);
}

function isJoinDomain(hostname: string): boolean {
  const host = hostname.split(":")[0];
  return hubDomains.some((d) => host === `join.${d}`);
}

/**
 * Read the x-org-id cookie and return the slug if it looks valid.
 * Edge-compatible — no DB access. The slug was already validated by
 * /api/auth/resolve-org when the cookie was set; the middleware just
 * passes it through as tenant context (same pattern as subdomain slugs).
 */
function resolveOrgFromCookie(request: NextRequest): string | null {
  const slug = request.cookies.get("x-org-id")?.value;
  if (!slug || typeof slug !== "string") return null;
  // Basic sanity: 2-10 alphanumeric chars (matches resolve-org API validation)
  if (!/^[a-zA-Z0-9]{2,10}$/.test(slug)) return null;
  return slug.toLowerCase();
}

// Paths exempt from CSRF check (auth flow, health, webhooks)
const csrfExemptPaths = [
  "/api/auth/",
  "/api/auth/resolve-org",
  "/api/session/pending",
  "/api/health",
  "/api/livekit/",
  "/api/tenants/signup",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "localhost";

  // Generate a per-request nonce for CSP
  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);

  /** Apply CSP + nonce headers to a NextResponse. */
  function applyCsp(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("x-nonce", nonce);
    return response;
  }

  // ── CSRF protection for API mutations ──
  const method = request.method.toUpperCase();
  if (
    pathname.startsWith("/api/") &&
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS" &&
    !csrfExemptPaths.some((p) => pathname.startsWith(p))
  ) {
    const csrfHeader = request.headers.get("x-hub-request");
    if (csrfHeader !== "1") {
      return applyCsp(NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      ));
    }
  }

  // ── Join subdomain → rewrite to /meeting ──
  if (isJoinDomain(hostname)) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/meeting";
      return applyCsp(NextResponse.rewrite(url));
    }
    return applyCsp(NextResponse.next());
  }

  // ── Root domain → cookie-based tenant resolution or public access ──
  if (isRootDomain(hostname)) {
    // Landing page and static assets are always accessible without a cookie
    if (
      pathname === "/" ||
      pathname.startsWith("/landing") ||
      pathname.startsWith("/_next") ||
      pathname.includes(".")
    ) {
      return applyCsp(NextResponse.next());
    }

    const rawOrgCookie = request.cookies.get("x-org-id")?.value;
    const orgSlug = resolveOrgFromCookie(request);

    // Cookie exists but slug is invalid format — clear it and redirect to /login
    if (rawOrgCookie && !orgSlug) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("x-org-id", "", { maxAge: 0, path: "/" });
      return response;
    }

    if (orgSlug) {
      // Cookie exists and slug format is valid — inject tenant headers
      // and continue with the same auth/routing logic as the subdomain flow.
      // The slug was validated by /api/auth/resolve-org when the cookie was set;
      // the middleware trusts it (same pattern as subdomain slugs).
      const headers = new Headers(request.headers);
      headers.set("x-tenant-id", orgSlug);
      headers.set("x-tenant-slug", orgSlug);

      // Allow public paths and static assets with tenant context
      if (
        publicPaths.some((p) => pathname.startsWith(p)) ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/session/pending") ||
        pathname.startsWith("/api/tenants")
      ) {
        return applyCsp(NextResponse.next({ request: { headers } }));
      }

      // Protected paths — check for auth token
      const token = request.cookies.get("hub-token")?.value;

      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      const payload = decodeJwtPayload(token);
      if (!payload) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.set("hub-token", "", { maxAge: 0, path: "/" });
        return response;
      }

      // Verify token tenant matches cookie tenant
      if (payload.tenantId && payload.tenantId !== orgSlug) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.set("hub-token", "", { maxAge: 0, path: "/" });
        return response;
      }

      // Route protection: locations go to /dashboard, ARLs go to /arl
      if (payload.userType === "location" && pathname.startsWith("/arl")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      if (payload.userType === "arl" && pathname === "/dashboard") {
        const hasMirrorParam = request.nextUrl.searchParams.has("mirror");
        if (!hasMirrorParam) {
          return NextResponse.redirect(new URL("/arl", request.url));
        }
      }

      return applyCsp(NextResponse.next({ request: { headers } }));
    }

    // No valid cookie — allow public paths without tenant context
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/_next") ||
      pathname.includes(".")
    ) {
      return applyCsp(NextResponse.next());
    }

    // No cookie and protected path → redirect to /login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Admin subdomain → super admin portal ──
  if (isAdminDomain(hostname)) {
    const headers = new Headers(request.headers);
    headers.set("x-admin-portal", "true");
    // Admin portal has its own auth flow
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/_next") ||
      pathname.includes(".")
    ) {
      return applyCsp(NextResponse.next({ request: { headers } }));
    }
    // Redirect to /admin
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // ── Tenant subdomain (e.g. kazi.meetthehub.com) ──
  const tenantSlug = extractTenantSlug(hostname);
  // For localhost / dev, treat as the default tenant
  const effectiveTenantId = tenantSlug || "kazi";

  // Inject tenant context into all requests
  const headers = new Headers(request.headers);
  headers.set("x-tenant-id", effectiveTenantId);
  headers.set("x-tenant-slug", effectiveTenantId);

  // Allow public paths and static assets
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/session/pending") ||
    pathname.startsWith("/api/tenants") ||
    pathname.includes(".")
  ) {
    return applyCsp(NextResponse.next({ request: { headers } }));
  }

  const token = request.cookies.get("hub-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("hub-token", "", { maxAge: 0, path: "/" });
    return response;
  }

  // Verify token tenant matches subdomain tenant
  if (payload.tenantId && payload.tenantId !== effectiveTenantId) {
    // User is logged into a different tenant — clear cookie and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("hub-token", "", { maxAge: 0, path: "/" });
    return response;
  }

  // Route protection: locations go to /dashboard, ARLs go to /arl
  if (payload.userType === "location" && pathname.startsWith("/arl")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (payload.userType === "arl" && pathname === "/dashboard") {
    // Allow ARLs to access /dashboard in mirror mode (with ?mirror= param)
    const hasMirrorParam = request.nextUrl.searchParams.has("mirror");
    if (!hasMirrorParam) {
      return NextResponse.redirect(new URL("/arl", request.url));
    }
  }

  // Redirect root to appropriate page
  if (pathname === "/") {
    if (payload.userType === "location") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/arl", request.url));
    }
  }

  return applyCsp(NextResponse.next({ request: { headers } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
