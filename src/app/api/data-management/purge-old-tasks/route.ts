import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    // Delete task completions older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().split("T")[0];

    const result = sqlite.prepare(
      "DELETE FROM task_completions WHERE completed_date < ?"
    ).run(cutoffDate);

    return apiSuccess({
      deletedCompletions: result.changes,
      cutoffDate,
    });
  } catch (error) {
    console.error("Purge old tasks error:", error);
    return ApiErrors.internal();
  }
}
