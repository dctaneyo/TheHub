import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Moved from /api/data-management/purge-broadcast-data — admin-session-gated
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

    const inTenantBroadcasts = "broadcast_id IN (SELECT id FROM broadcasts WHERE tenant_id = ?)";

    let deletedBroadcasts = 0;
    let deletedMessages = 0;
    let deletedQuestions = 0;
    let deletedReactions = 0;
    let deletedViewers = 0;

    try { deletedViewers = sqlite.prepare(`DELETE FROM broadcast_viewers WHERE ${inTenantBroadcasts}`).run(tenantId).changes; } catch (err) { console.error("Purge broadcast_viewers:", err); }
    try { deletedReactions = sqlite.prepare(`DELETE FROM broadcast_reactions WHERE ${inTenantBroadcasts}`).run(tenantId).changes; } catch (err) { console.error("Purge broadcast_reactions:", err); }
    try { deletedMessages = sqlite.prepare(`DELETE FROM broadcast_messages WHERE ${inTenantBroadcasts}`).run(tenantId).changes; } catch (err) { console.error("Purge broadcast_messages:", err); }
    try { deletedQuestions = sqlite.prepare(`DELETE FROM broadcast_questions WHERE ${inTenantBroadcasts}`).run(tenantId).changes; } catch (err) { console.error("Purge broadcast_questions:", err); }
    try { deletedBroadcasts = sqlite.prepare("DELETE FROM broadcasts WHERE tenant_id = ?").run(tenantId).changes; } catch (err) { console.error("Purge broadcasts:", err); }

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "purge", entityType: "broadcast_data", affectedCount: deletedBroadcasts + deletedMessages + deletedQuestions, payload: { deletedBroadcasts, deletedMessages, deletedQuestions, deletedReactions, deletedViewers }, status: "success" });

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
