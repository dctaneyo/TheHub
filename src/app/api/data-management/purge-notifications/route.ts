import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { logAudit } from "@/lib/audit-logger";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    let deletedNotifications = 0;
    let deletedEmergency = 0;

    try { deletedNotifications = sqlite.prepare("DELETE FROM notifications").run().changes; } catch (e) { console.error("Purge notifications error:", e); }
    try { deletedEmergency = sqlite.prepare("DELETE FROM emergency_messages").run().changes; } catch (e) { console.error("Purge emergency_messages error:", e); }

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "purge", entityType: "notifications", affectedCount: deletedNotifications + deletedEmergency, payload: { deletedNotifications, deletedEmergency }, status: "success" });

    return apiSuccess({
      deletedNotifications,
      deletedEmergency,
    });
  } catch (error) {
    console.error("Purge notifications error:", error);
    return ApiErrors.internal();
  }
}
