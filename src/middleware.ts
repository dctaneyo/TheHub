import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth/login"];

// Edge-compatible JWT decode (no crypto verification — cookie is httpOnly,
// full verification happens in API routes via jsonwebtoken)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/session/pending") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
