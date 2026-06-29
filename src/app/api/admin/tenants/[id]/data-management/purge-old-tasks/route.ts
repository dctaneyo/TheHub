import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Moved from /api/data-management/purge-old-tasks — admin-session-gated
// only, plus PIN re-confirmation since this is irreversible.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().split("T")[0];

    // task_completions has no tenantId of its own — scope via the task it
    // completes (tasks.tenant_id).
    const result = sqlite.prepare(
      "DELETE FROM task_completions WHERE completed_date < ? AND task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)"
    ).run(cutoffDate, tenantId);

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "purge", entityType: "task_completions", affectedCount: result.changes, payload: { cutoffDate }, status: "success" });

    return apiSuccess({
      deletedCompletions: result.changes,
      cutoffDate,
    });
  } catch (error) {
    console.error("Purge old tasks error:", error);
    return ApiErrors.internal();
  }
}
