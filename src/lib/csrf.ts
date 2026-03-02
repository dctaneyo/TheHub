import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection using a custom header check.
 *
 * Browsers enforce that cross-origin requests cannot set custom headers
 * without a CORS preflight. Since our Socket.io CORS is restricted to
 * our own domains, any request from a foreign origin that tries to set
 * `X-Hub-Request: 1` will be blocked by the browser's preflight check.
 *
 * Usage in API routes:
 *   const csrfError = checkCsrf(req);
 *   if (csrfError) return csrfError;
 */

const HEADER_NAME = "x-hub-request";

export function checkCsrf(req: NextRequest): NextResponse | null {
  // Only enforce on mutation methods
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // Check for custom header — browsers block cross-origin custom headers
  const headerValue = req.headers.get(HEADER_NAME);
  if (headerValue === "1") {
    return null; // Valid
  }

  return NextResponse.json(
    { error: "CSRF validation failed — missing X-Hub-Request header" },
    { status: 403 }
  );
}
