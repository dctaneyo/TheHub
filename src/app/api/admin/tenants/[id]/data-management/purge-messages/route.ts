import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Messages don't carry their own tenantId — they're scoped via their
// conversation's tenantId. Moved from /api/data-management/purge-messages —
// admin-session-gated only, plus PIN re-confirmation since this is
// irreversible.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

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

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "purge", entityType: "messages", affectedCount: messageCount + readCount + reactionCount, payload: { deletedMessages: messageCount, deletedReads: readCount, deletedReactions: reactionCount }, status: "success" });

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
