import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { logAudit } from "@/lib/audit-logger";

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const { mode } = await request.json();

    let deleted = 0;

    if (mode === "stale") {
      // Clear sessions older than 7 days that are offline
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const r = sqlite.prepare(
        "DELETE FROM sessions WHERE is_online = 0 AND last_seen < ?"
      ).run(sevenDaysAgo.toISOString());
      deleted = r.changes;
    } else if (mode === "all-offline") {
      // Clear all offline sessions
      const r = sqlite.prepare("DELETE FROM sessions WHERE is_online = 0").run();
      deleted = r.changes;
    } else if (mode === "force-all") {
      // Force logout everyone (except current session)
      const r = sqlite.prepare(
        "DELETE FROM sessions WHERE session_code != ?"
      ).run(session.sessionCode || "");
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
