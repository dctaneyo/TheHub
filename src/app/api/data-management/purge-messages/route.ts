import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { logAudit } from "@/lib/audit-logger";

// Messages don't carry their own tenantId — they're scoped via their
// conversation's tenantId. All three deletes below must stay within that
// boundary; an earlier version purged every tenant's messages at once.
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
    const inTenantConversations = "conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)";
    const inTenantMessages = `message_id IN (SELECT id FROM messages WHERE ${inTenantConversations})`;

    let reactionCount = 0;
    try {
      reactionCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM message_reactions WHERE ${inTenantMessages}`).get(tenantId) as { c: number }).c;
    } catch (e) {
      console.error("Failed to count message reactions (table may not exist):", e);
    }
    const messageCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM messages WHERE ${inTenantConversations}`).get(tenantId) as { c: number }).c;
    const readCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM message_reads WHERE ${inTenantMessages}`).get(tenantId) as { c: number }).c;

    try {
      sqlite.prepare(`DELETE FROM message_reactions WHERE ${inTenantMessages}`).run(tenantId);
    } catch (e) {
      console.error("Failed to delete message reactions (table may not exist):", e);
    }
    sqlite.prepare(`DELETE FROM message_reads WHERE ${inTenantMessages}`).run(tenantId);
    sqlite.prepare(`DELETE FROM messages WHERE ${inTenantConversations}`).run(tenantId);

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "purge", entityType: "messages", affectedCount: messageCount + readCount + reactionCount, payload: { deletedMessages: messageCount, deletedReads: readCount, deletedReactions: reactionCount }, status: "success" });

    return apiSuccess({
      deletedMessages: messageCount,
      deletedReads: readCount,
      deletedReactions: reactionCount,
    });
  } catch (error) {
    console.error("Purge messages error:", error);
    return ApiErrors.internal();
  }
}
