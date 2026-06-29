import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { logAudit } from "@/lib/audit-logger";

// sessions.userId references either locations.id or arls.id, with no
// tenantId of its own — scope through whichever parent table user_type
// points at. Takes two tenantId params (one per branch of the OR).
const IN_TENANT = `(
  (user_type = 'location' AND user_id IN (SELECT id FROM locations WHERE tenant_id = ?))
  OR (user_type = 'arl' AND user_id IN (SELECT id FROM arls WHERE tenant_id = ?))
)`;

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request.headers);
    const rl = checkRateLimit(`data-management:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const { mode } = await request.json();
    const tenantId = session.tenantId;

    let deleted = 0;

    if (mode === "stale") {
      // Clear sessions older than 7 days that are offline
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const r = sqlite.prepare(
        `DELETE FROM sessions WHERE is_online = 0 AND last_seen < ? AND ${IN_TENANT}`
      ).run(sevenDaysAgo.toISOString(), tenantId, tenantId);
      deleted = r.changes;
    } else if (mode === "all-offline") {
      // Clear all offline sessions
      const r = sqlite.prepare(`DELETE FROM sessions WHERE is_online = 0 AND ${IN_TENANT}`).run(tenantId, tenantId);
      deleted = r.changes;
    } else if (mode === "force-all") {
      // Force logout everyone in this tenant (except current session)
      const r = sqlite.prepare(
        `DELETE FROM sessions WHERE session_code != ? AND ${IN_TENANT}`
      ).run(session.sessionCode || "", tenantId, tenantId);
      deleted = r.changes;
    } else {
      return ApiErrors.badRequest("Invalid mode");
    }

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "clear_sessions", entityType: "sessions", affectedCount: deleted, payload: { mode }, status: "success" });

    return apiSuccess({ deleted, mode });
  } catch (error) {
    console.error("Clear sessions error:", error);
    return ApiErrors.internal();
  }
}
