import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Moved from /api/data-management/purge-conversations — admin-session-gated
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

    const globalConvo = sqlite.prepare(
      "SELECT id FROM conversations WHERE type = 'global' AND tenant_id = ? LIMIT 1"
    ).get(tenantId) as { id: string } | undefined;

    let deletedMessages = 0;
    try {
      const r = globalConvo
        ? sqlite.prepare("DELETE FROM messages WHERE conversation_id != ? AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(globalConvo.id, tenantId)
        : sqlite.prepare("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(tenantId);
      deletedMessages = r.changes;
    } catch (e) {
      console.error("Failed to delete messages from non-global conversations:", e);
    }

    let deletedReads = 0;
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?))"
      ).run(tenantId);
      deletedReads = r.changes;
    } catch (e) {
      console.error("Failed to delete message reads:", e);
    }

    let deletedReactions = 0;
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?))"
      ).run(tenantId);
      deletedReactions = r.changes;
    } catch (e) {
      console.error("Failed to delete message reactions:", e);
    }

    let deletedMembers = 0;
    try {
      const r = globalConvo
        ? sqlite.prepare("DELETE FROM conversation_members WHERE conversation_id != ? AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(globalConvo.id, tenantId)
        : sqlite.prepare("DELETE FROM conversation_members WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)").run(tenantId);
      deletedMembers = r.changes;
    } catch (e) {
      console.error("Failed to delete conversation members:", e);
    }

    const result = globalConvo
      ? sqlite.prepare("DELETE FROM conversations WHERE type != 'global' AND tenant_id = ?").run(tenantId)
      : sqlite.prepare("DELETE FROM conversations WHERE tenant_id = ?").run(tenantId);
    const deletedConversations = result.changes;

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

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "purge", entityType: "conversations", affectedCount: deletedConversations + deletedMessages, payload: { deletedConversations, deletedMessages, deletedReads, deletedReactions, deletedMembers }, status: "success" });

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
