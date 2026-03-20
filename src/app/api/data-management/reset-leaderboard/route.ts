import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { logAudit } from "@/lib/audit-logger";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const count = db.select().from(schema.taskCompletions).all().length;
    db.delete(schema.taskCompletions).run();

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "reset", entityType: "leaderboard", affectedCount: count, status: "success" });

    return apiSuccess({
      deletedCompletions: count,
    });
  } catch (error) {
    console.error("Reset leaderboard error:", error);
    return ApiErrors.internal();
  }
}
