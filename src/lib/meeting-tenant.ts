import { db, schema, sqlite } from "@/lib/db";
import { eq } from "drizzle-orm";
import { findActiveMeetingByCode } from "@/lib/socket-server";

/**
 * Resolve the organization (tenant id) for a meeting code.
 *
 * The join.* entry point has no tenant context (no org subdomain/cookie), but a
 * meeting's host is an ARL whose tenant IS the organization. This lets
 * restaurants/ARLs authenticate from the join page (login + validate-user)
 * scoped to the correct org, without separately selecting it.
 *
 * Returns the tenant id, or null if the meeting/host can't be resolved.
 */
export function resolveTenantFromMeetingCode(
  meetingCode: string | null | undefined
): string | null {
  const code = (meetingCode ?? "").toUpperCase().trim();
  if (!code) return null;

  let hostId: string | null = null;

  // Scheduled meeting (DB)
  const scheduled = sqlite
    .prepare("SELECT host_id FROM scheduled_meetings WHERE meeting_code = ? AND is_active = 1")
    .get(code) as { host_id?: string } | undefined;
  if (scheduled?.host_id) {
    hostId = scheduled.host_id;
  } else {
    // On-demand meeting (in-memory, created via BroadcastStudio)
    const active = findActiveMeetingByCode(code);
    if (active?.hostId) hostId = active.hostId;
  }

  if (!hostId) return null;

  const host = db
    .select({ tenantId: schema.arls.tenantId })
    .from(schema.arls)
    .where(eq(schema.arls.id, hostId))
    .get();

  return host?.tenantId ?? null;
}
