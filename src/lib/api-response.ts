import { NextResponse } from "next/server";

/**
 * Standardized API response helpers.
 * All API routes should use these to ensure consistent response shapes:
 *
 * Success: { ok: true, data: { ... } }
 * Error:   { ok: false, error: { code: "ERROR_CODE", message: "Human-readable message" } }
 */

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
}

// Common error shortcuts
export const ApiErrors = {
  unauthorized: () => apiError("UNAUTHORIZED", "Not authenticated", 401),
  forbidden: (msg = "Not authorized") => apiError("FORBIDDEN", msg, 403),
  notFound: (entity = "Resource") => apiError("NOT_FOUND", `${entity} not found`, 404),
  badRequest: (msg: string) => apiError("BAD_REQUEST", msg, 400),
  tooManyRequests: (retryAfterSec: number) => {
    const res = apiError("TOO_MANY_REQUESTS", `Too many attempts. Try again in ${retryAfterSec}s.`, 429);
    res.headers.set("Retry-After", String(retryAfterSec));
    return res;
  },
  internal: (msg = "Internal server error") => apiError("INTERNAL_ERROR", msg, 500),
} as const;
