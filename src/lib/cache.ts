/**
 * Simple in-memory cache with TTL (time-to-live).
 * Use for frequently-read, infrequently-written data like location lists,
 * today's tasks, and leaderboard data.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

/**
 * Get a cached value. Returns undefined if not found or expired.
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/**
 * Set a cached value with TTL in seconds.
 */
export function cacheSet<T>(key: string, data: T, ttlSeconds: number): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate a specific cache key.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all cache keys matching a prefix.
 * Example: cacheInvalidatePrefix("tasks:") clears all task caches.
 */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear entire cache.
 */
export function cacheClear(): void {
  store.clear();
}

/**
 * Get-or-set pattern: returns cached value if available, otherwise calls
 * the factory function, caches the result, and returns it.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  factory: () => T | Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const data = await factory();
  cacheSet(key, data, ttlSeconds);
  return data;
}

// Clean up expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}, 2 * 60 * 1000);
