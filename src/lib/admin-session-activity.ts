/**
 * Server-enforced inactivity tracking for Admin Console sessions.
 *
 * A client-side idle timer can be bypassed by simply not running that JS —
 * the actual 5-minute inactivity rule is enforced here, independent of
 * whatever countdown the UI shows. Same globalThis-pinned-Map pattern as
 * rate-limiter.ts, so all routes share one store across route bundles.
 *
 * A server restart clears this map, which means an in-flight admin session
 * is treated as "not idle" until its next request re-establishes a
 * timestamp — a minor, acceptable grace period (the JWT's own 24h expiry
 * and the account-keyed PIN step are the real auth gates; this is a
 * defense-in-depth measure on top of those, not the primary one).
 */

const MAX_IDLE_MS = 5 * 60 * 1000;

const _g = globalThis as { __hubAdminActivityStore?: Map<string, number> };
if (!_g.__hubAdminActivityStore) {
  _g.__hubAdminActivityStore = new Map<string, number>();
}
const store = _g.__hubAdminActivityStore;

/** True if this admin has been idle for longer than the allowed window. Does not touch the timestamp. */
export function isAdminSessionIdle(adminId: string): boolean {
  const last = store.get(adminId);
  if (last === undefined) return false; // no record yet — give the benefit of the doubt, touch() below establishes one
  return Date.now() - last > MAX_IDLE_MS;
}

/** Records this request as activity, resetting the idle window. */
export function touchAdminActivity(adminId: string): void {
  store.set(adminId, Date.now());
}

/** Clears tracked activity (e.g. on logout) so a stale entry can't linger. */
export function clearAdminActivity(adminId: string): void {
  store.delete(adminId);
}
