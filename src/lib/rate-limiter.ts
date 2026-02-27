/**
 * In-memory rate limiter for API routes.
 * Tracks attempts per key (usually IP address) with a sliding window.
 */

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      store.delete(key);
    } else if (now - entry.firstAttempt > 60_000) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxAttempts: number;       // max attempts per window
  windowMs: number;          // window duration in ms
  lockoutMs?: number;        // lockout duration after exceeding limit (default: 5 min)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Check if a request is allowed under the rate limit.
 * @param key - Unique identifier (e.g., IP address or IP:userId)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const lockoutMs = config.lockoutMs ?? 5 * 60 * 1000;
  const entry = store.get(key);

  // Currently locked out
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.lockedUntil - now,
    };
  }

  // No entry or window expired — reset
  if (!entry || now - entry.firstAttempt > config.windowMs) {
    store.set(key, { attempts: 1, firstAttempt: now });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  // Within window
  entry.attempts++;

  if (entry.attempts > config.maxAttempts) {
    // Lock out
    entry.lockedUntil = now + lockoutMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: lockoutMs,
    };
  }

  return { allowed: true, remaining: config.maxAttempts - entry.attempts };
}

/**
 * Reset rate limit for a key (e.g., after successful login).
 */
export function resetRateLimit(key: string) {
  store.delete(key);
}

/**
 * Extract client IP from request headers (works behind proxies like Railway).
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
