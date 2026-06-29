import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { logAudit } from "@/lib/audit-logger";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request.headers);
    const rl = checkRateLimit(`data-management:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const tenantId = session.tenantId;
    // Children reference broadcast_id only, not tenant_id directly — scope
    // through the parent broadcasts row, and delete children before the
    // parent so the subquery still finds them.
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
