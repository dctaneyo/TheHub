import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ApiErrors } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set("hub-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

// Sanitize redirect path — only allow relative paths starting with /
function safeRedirect(raw: string | null): string {
  if (!raw) return "/login";
  // Strip anything that isn't a simple relative path
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/login";
  // Remove any characters that could break out of a JS string literal
  return raw.replace(/["'<>\\]/g, "");
}

// Org slugs are 2-10 alphanumeric chars (same format check as resolve-org) —
// reject anything else rather than interpolating it into the script tag.
function safeOrgSlug(raw: string | null): string | null {
  if (!raw || !/^[a-zA-Z0-9]{2,10}$/.test(raw)) return null;
  return raw.toLowerCase();
}

// The root origin — used to build the redirect URL without relying on
// req.url, which exposes the internal 0.0.0.0 address on Railway/custom-server
// deployments and would produce a broken redirect.
const ROOT_ORIGIN = process.env.NODE_ENV === "production" ? "https://meetthehub.com" : "http://localhost:3000";

// GET - Apply token from query params, set cookies, server-side redirect.
// Previously used an inline-<script> HTML response, but the nonce-based CSP
// the middleware applies to every root-domain response blocked that script,
// causing a blank white page on impersonation hand-off.  Using a proper
// NextResponse.redirect with server-set cookies avoids the script entirely.
export async function GET(req: NextRequest) {
  const ip = getClientIP(req.headers);
  const isImpersonation = req.nextUrl.searchParams.get("imp") === "1";
  // Impersonation hand-offs get their own rate-limit bucket — the default
  // force-apply:${ip} bucket is also used by unrelated QR/remote-login
  // traffic from the same office IP, which shouldn't collide with this.
  const rlKey = isImpersonation ? `force-apply:imp:${ip}` : `force-apply:${ip}`;
  const rl = checkRateLimit(rlKey, { maxAttempts: 20, windowMs: 60_000, lockoutMs: 2 * 60_000 });
  if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

  const token = req.nextUrl.searchParams.get("token");
  const redirectTo = safeRedirect(req.nextUrl.searchParams.get("redirect"));
  // Tenants resolve via the x-org-id cookie on the root domain (not a
  // per-org subdomain) — an impersonation hand-off from nimda.meetthehub.com
  // needs to set this cookie so middleware has org context once it lands.
  const orgSlug = safeOrgSlug(req.nextUrl.searchParams.get("org"));

  if (!token || !verifyToken(token)) {
    return NextResponse.redirect(new URL("/login", ROOT_ORIGIN));
  }

  const response = NextResponse.redirect(new URL(redirectTo, ROOT_ORIGIN));
  setTokenCookie(response, token);

  if (orgSlug) {
    // x-org-id is intentionally not httpOnly — the login page sets/clears it
    // via document.cookie.  Setting it server-side here on a redirect response
    // is equivalent and avoids any script that CSP would otherwise block.
    response.cookies.set("x-org-id", orgSlug, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return response;
}

// POST - Apply token from JSON body, set cookie, client handles redirect
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`force-apply:${ip}`, { maxAttempts: 20, windowMs: 60_000, lockoutMs: 2 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const { token } = await req.json();

    if (!token || !verifyToken(token)) {
      return ApiErrors.badRequest("Invalid token");
    }

    // Cookie needs to be set on the response, so keep NextResponse.json
    const response = NextResponse.json({ ok: true, success: true });
    setTokenCookie(response, token);
    return response;
  } catch {
    return ApiErrors.badRequest("Invalid request");
  }
}
