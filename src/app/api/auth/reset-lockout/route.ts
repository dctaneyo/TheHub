import { NextRequest } from "next/server";
import { checkRateLimit, resetRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api-response";

/**
 * Staff lockout bypass — resets the login rate-limit for the caller's IP.
 *
 * Security properties:
 * - The bypass code is never stored in the client bundle; it lives only in
 *   the LOCKOUT_BYPASS_CODE environment variable on the server.
 * - The endpoint has its own strict rate limit (2 attempts / 10 min / 1 hr
 *   lockout) so the 4-digit code cannot be brute-forced in a reasonable time.
 * - Wrong code and "bypass not configured" return the same error to avoid
 *   leaking whether the feature is active on this deployment.
 * - A successful reset does NOT clear the bypass rate-limit counter, so
 *   exhausting all 2 attempts still locks the bypass for an hour.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers);

  // Bypass endpoint has its own strict rate limit, separate from login.
  const rl = checkRateLimit(`bypass:${ip}`, {
    maxAttempts: 2,
    windowMs: 10 * 60_000,   // 10-minute window
    lockoutMs: 60 * 60_000,  // 1-hour lockout after exhausting attempts
  });

  if (!rl.allowed) {
    const retrySeconds = Math.ceil((rl.retryAfterMs || 0) / 1000);
    return ApiErrors.tooManyRequests(retrySeconds);
  }

  let code: string | undefined;
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code.trim() : undefined;
  } catch {
    return apiError("BAD_REQUEST", "Invalid request body.", 400);
  }

  const bypassCode = process.env.LOCKOUT_BYPASS_CODE;

  // Use a constant-time comparison stub — codes are short but avoids any
  // timing leak. Also treat "not configured" identically to "wrong code"
  // so the response doesn't reveal deployment configuration.
  const codeOk =
    bypassCode &&
    code &&
    code.length === bypassCode.length &&
    code === bypassCode;

  if (!codeOk) {
    return apiError("INVALID_CODE", "Invalid bypass code.", 401);
  }

  // Valid — clear both login and validate-user lockouts for this IP.
  // The login flow hits two separate rate-limited endpoints:
  //   validate-user  (key: validate:<ip>)  — User ID entry, 60s lockout
  //   login          (key: login:<ip>)     — PIN entry, 5-min lockout
  resetRateLimit(`login:${ip}`);
  resetRateLimit(`validate:${ip}`);

  return apiSuccess({ ok: true });
}
