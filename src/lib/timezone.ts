import { db, schema } from "./db";
import { eq } from "drizzle-orm";

/**
 * Get the IANA timezone for a tenant. Falls back to "Pacific/Honolulu" for
 * backward compatibility if the column hasn't been populated yet.
 */
export function getTenantTimezone(tenantId: string): string {
  try {
    const row = db
      .select({ timezone: schema.tenants.timezone })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .get();
    return row?.timezone || "Pacific/Honolulu";
  } catch {
    return "Pacific/Honolulu";
  }
}

/**
 * Get the IANA timezone for a specific location.
 * Checks the location's own timezone first, then falls back to the tenant's timezone.
 */
export function getLocationTimezone(locationId: string): string {
  try {
    const row = db
      .select({ timezone: schema.locations.timezone, tenantId: schema.locations.tenantId })
      .from(schema.locations)
      .where(eq(schema.locations.id, locationId))
      .get();
    if (!row) return "Pacific/Honolulu";
    return row.timezone || getTenantTimezone(row.tenantId);
  } catch {
    return "Pacific/Honolulu";
  }
}

/** Get a Date object representing "now" in the given IANA timezone. */
export function tzNow(tz: string): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(str);
}

/** Get today's YYYY-MM-DD string in the given timezone. */
export function tzTodayStr(tz: string): string {
  const d = tzNow(tz);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get the lowercase day-of-week name in the given timezone. */
export function tzDayOfWeek(tz: string): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][tzNow(tz).getDay()];
}
