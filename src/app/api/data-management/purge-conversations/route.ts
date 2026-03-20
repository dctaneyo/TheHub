import { NextResponse } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { logAudit } from "@/lib/audit-logger";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    // Get global conversation ID before purging
    const globalConvo = sqlite.prepare(
      "SELECT id FROM conversations WHERE type = 'global' LIMIT 1"
    ).get() as { id: string } | undefined;

    // Delete messages from non-global conversations
    let deletedMessages = 0;
    try {
      if (globalConvo) {
        const r = sqlite.prepare("DELETE FROM messages WHERE conversation_id != ?").run(globalConvo.id);
        deletedMessages = r.changes;
      } else {
        const r = sqlite.prepare("DELETE FROM messages").run();
        deletedMessages = r.changes;
      }
    } catch (e) {
      console.error("Failed to delete messages from non-global conversations:", e);
    }

    // Delete all message reads
    let deletedReads = 0;
    try {
      const r = sqlite.prepare("DELETE FROM message_reads").run();
      deletedReads = r.changes;
    } catch (e) {
      console.error("Failed to delete message reads:", e);
    }

    // Delete all message reactions
    let deletedReactions = 0;
    try {
      const r = sqlite.prepare("DELETE FROM message_reactions").run();
      deletedReactions = r.changes;
    } catch (e) {
      console.error("Failed to delete message reactions:", e);
    }

    // Delete conversation members from non-global conversations
    let deletedMembers = 0;
    try {
      if (globalConvo) {
        const r = sqlite.prepare("DELETE FROM conversation_members WHERE conversation_id != ?").run(globalConvo.id);
        deletedMembers = r.changes;
      } else {
        const r = sqlite.prepare("DELETE FROM conversation_members").run();
        deletedMembers = r.changes;
      }
    } catch (e) {
      console.error("Failed to delete conversation members:", e);
    }

    // Delete all non-global conversations
    let deletedConversations = 0;
    if (globalConvo) {
      const result = sqlite.prepare("DELETE FROM conversations WHERE type != 'global'").run();
      deletedConversations = result.changes;
    } else {
      const result = sqlite.prepare("DELETE FROM conversations").run();
      deletedConversations = result.changes;
    }

    // Ensure global conversation exists
    const globalExists = sqlite.prepare(
      "SELECT id FROM conversations WHERE type = 'global' LIMIT 1"
    ).get();

    if (!globalExists) {
      const globalId = uuid();
      sqlite.prepare(`
        INSERT INTO conversations (id, type, name, created_at)
        VALUES (?, 'global', 'Global Chat', ?)
      `).run(globalId, new Date().toISOString());
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
