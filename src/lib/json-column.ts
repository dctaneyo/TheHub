/**
 * Safely parse a JSON-string DB column (recurringDays, deletedBy, viewedBy,
 * targetLocationIds, features, metadata, etc). These are stored as plain
 * TEXT columns with no schema validation, so a malformed or unexpected
 * value must not crash the request — return `fallback` instead of letting
 * `JSON.parse` throw.
 */
export function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
