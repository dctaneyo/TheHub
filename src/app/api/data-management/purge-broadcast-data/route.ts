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

    let deletedBroadcasts = 0;
    let deletedMessages = 0;
    let deletedQuestions = 0;
    let deletedReactions = 0;
    let deletedViewers = 0;

    try { deletedViewers = sqlite.prepare("DELETE FROM broadcast_viewers").run().changes; } catch (err) { console.error("Purge broadcast_viewers:", err); }
    try { deletedReactions = sqlite.prepare("DELETE FROM broadcast_reactions").run().changes; } catch (err) { console.error("Purge broadcast_reactions:", err); }
    try { deletedMessages = sqlite.prepare("DELETE FROM broadcast_messages").run().changes; } catch (err) { console.error("Purge broadcast_messages:", err); }
    try { deletedQuestions = sqlite.prepare("DELETE FROM broadcast_questions").run().changes; } catch (err) { console.error("Purge broadcast_questions:", err); }
    try { deletedBroadcasts = sqlite.prepare("DELETE FROM broadcasts").run().changes; } catch (err) { console.error("Purge broadcasts:", err); }

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "purge", entityType: "broadcast_data", affectedCount: deletedBroadcasts + deletedMessages + deletedQuestions, payload: { deletedBroadcasts, deletedMessages, deletedQuestions, deletedReactions, deletedViewers }, status: "success" });

    return apiSuccess({
      deletedBroadcasts,
      deletedMessages,
      deletedQuestions,
      deletedReactions,
      deletedViewers,
    });
  } catch (error) {
    console.error("Purge broadcast data error:", error);
    return ApiErrors.internal();
  }
}
