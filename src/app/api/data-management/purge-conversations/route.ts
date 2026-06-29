import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
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

    // Get this tenant's global conversation ID before purging
    const globalConvo = sqlite.prepare(
      "SELECT id FROM conversations WHERE type = 'global' AND tenant_id = ? LIMIT 1"
    ).get(tenantId) as { id: string } | undefined;

    // Delete messages from this tenant's non-global conversations
    let deletedMessages = 0;
    try {
      const r = globalConvo
        ? sqlite.prepare("DELETE FROM messages WHERE conversation_id != ? AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(globalConvo.id, tenantId)
        : sqlite.prepare("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(tenantId);
      deletedMessages = r.changes;
    } catch (e) {
      console.error("Failed to delete messages from non-global conversations:", e);
    }

    // Delete this tenant's message reads (scoped via the messages just identified by conversation)
    let deletedReads = 0;
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?))"
      ).run(tenantId);
      deletedReads = r.changes;
    } catch (e) {
      console.error("Failed to delete message reads:", e);
    }

    // Delete this tenant's message reactions
    let deletedReactions = 0;
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?))"
      ).run(tenantId);
      deletedReactions = r.changes;
    } catch (e) {
      console.error("Failed to delete message reactions:", e);
    }

    // Delete conversation members from this tenant's non-global conversations
    let deletedMembers = 0;
    try {
      const r = globalConvo
        ? sqlite.prepare("DELETE FROM conversation_members WHERE conversation_id != ? AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(globalConvo.id, tenantId)
        : sqlite.prepare("DELETE FROM conversation_members WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(tenantId);
      deletedMembers = r.changes;
    } catch (e) {
      console.error("Failed to delete conversation members:", e);
    }

    // Delete this tenant's non-global conversations
    const result = globalConvo
      ? sqlite.prepare("DELETE FROM conversations WHERE type != 'global' AND tenant_id = ?").run(tenantId)
      : sqlite.prepare("DELETE FROM conversations WHERE tenant_id = ?").run(tenantId);
    const deletedConversations = result.changes;

    // Ensure this tenant still has a global conversation
    const globalExists = sqlite.prepare(
      "SELECT id FROM conversations WHERE type = 'global' AND tenant_id = ? LIMIT 1"
    ).get(tenantId);

    if (!globalExists) {
      const globalId = uuid();
      sqlite.prepare(`
        INSERT INTO conversations (id, tenant_id, type, name, created_at)
        VALUES (?, ?, 'global', 'Global Chat', ?)
      `).run(globalId, tenantId, new Date().toISOString());
    }

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "purge", entityType: "conversations", affectedCount: deletedConversations + deletedMessages, payload: { deletedConversations, deletedMessages, deletedReads, deletedReactions, deletedMembers }, status: "success" });

    return apiSuccess({
      deletedConversations,
      deletedMessages,
      deletedReads,
      deletedReactions,
      deletedMembers,
      globalConversationPreserved: true,
    });
  } catch (error) {
    console.error("Purge conversations error:", error);
    return ApiErrors.internal();
  }
}
