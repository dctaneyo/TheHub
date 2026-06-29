import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Moved from /api/data-management/orphaned-cleanup — deliberately not
// tenant-scoped: every row this deletes has already lost its parent, so
// there's no tenant left to attribute it to or restrict the cleanup to.
// PIN re-confirmation required.
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    let orphanedMessages = 0;
    let orphanedReads = 0;
    let orphanedReactions = 0;
    let orphanedCompletions = 0;

    try {
      const r = sqlite.prepare("DELETE FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)").run();
      orphanedMessages = r.changes;
    } catch (err) { console.error("Orphaned cleanup: messages error:", err); }

    try {
      const r = sqlite.prepare("DELETE FROM message_reads WHERE message_id NOT IN (SELECT id FROM messages)").run();
      orphanedReads = r.changes;
    } catch (err) { console.error("Orphaned cleanup: reads error:", err); }

    try {
      const r = sqlite.prepare("DELETE FROM message_reactions WHERE message_id NOT IN (SELECT id FROM messages)").run();
      orphanedReactions = r.changes;
    } catch (err) { console.error("Orphaned cleanup: reactions error:", err); }

    try {
      const r = sqlite.prepare("DELETE FROM task_completions WHERE task_id NOT IN (SELECT id FROM tasks)").run();
      orphanedCompletions = r.changes;
    } catch (err) { console.error("Orphaned cleanup: completions error:", err); }

    const total = orphanedMessages + orphanedReads + orphanedReactions + orphanedCompletions;

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "orphaned_cleanup", entityType: "mixed", affectedCount: total, payload: { orphanedMessages, orphanedReads, orphanedReactions, orphanedCompletions }, status: "success" });

    return apiSuccess({ orphanedMessages, orphanedReads, orphanedReactions, orphanedCompletions, total });
  } catch (error) {
    console.error("Orphaned cleanup error:", error);
    return ApiErrors.internal();
  }
}
