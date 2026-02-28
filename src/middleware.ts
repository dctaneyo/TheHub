import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth/login", "/meeting", "/api/meetings/join", "/api/livekit/token"];
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "localhost";

  // ── Join subdomain → rewrite to /meeting ──
  if (isJoinDomain(hostname)) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/meeting";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ── Root domain → landing page ──
  if (isRootDomain(hostname)) {
    // Allow the landing page and static assets
    if (
      pathname === "/" ||
      pathname.startsWith("/landing") ||
      pathname.startsWith("/_next") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }
    // Redirect everything else to root landing
    return NextResponse.redirect(new URL("/", request.url));
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
      return NextResponse.next({ request: { headers } });
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
    return NextResponse.next({ request: { headers } });
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
    return NextResponse.redirect(new URL("/arl", request.url));
  }

  // Redirect root to appropriate page
  if (pathname === "/") {
    if (payload.userType === "location") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/arl", request.url));
    }
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
