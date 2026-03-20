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

    let orphanedMessages = 0;
    let orphanedReads = 0;
    let orphanedReactions = 0;
    let orphanedCompletions = 0;

    // Delete messages whose conversation no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)"
      ).run();
      orphanedMessages = r.changes;
    } catch (err) { console.error("Orphaned cleanup: messages error:", err); }

    // Delete message_reads whose message no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reads WHERE message_id NOT IN (SELECT id FROM messages)"
      ).run();
      orphanedReads = r.changes;
    } catch (err) { console.error("Orphaned cleanup: reads error:", err); }

    // Delete message_reactions whose message no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reactions WHERE message_id NOT IN (SELECT id FROM messages)"
      ).run();
      orphanedReactions = r.changes;
    } catch (err) { console.error("Orphaned cleanup: reactions error:", err); }

    // Delete task_completions whose task no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM task_completions WHERE task_id NOT IN (SELECT id FROM tasks)"
      ).run();
      orphanedCompletions = r.changes;
    } catch (err) { console.error("Orphaned cleanup: completions error:", err); }

    const total = orphanedMessages + orphanedReads + orphanedReactions + orphanedCompletions;

    return apiSuccess({
      orphanedMessages,
      orphanedReads,
      orphanedReactions,
      orphanedCompletions,
      total,
    });
  } catch (error) {
    console.error("Orphaned cleanup error:", error);
    return ApiErrors.internal();
  }
}
