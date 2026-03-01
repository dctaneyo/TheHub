import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
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
    } catch {}

    // Delete message_reads whose message no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reads WHERE message_id NOT IN (SELECT id FROM messages)"
      ).run();
      orphanedReads = r.changes;
    } catch {}

    // Delete message_reactions whose message no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM message_reactions WHERE message_id NOT IN (SELECT id FROM messages)"
      ).run();
      orphanedReactions = r.changes;
    } catch {}

    // Delete task_completions whose task no longer exists
    try {
      const r = sqlite.prepare(
        "DELETE FROM task_completions WHERE task_id NOT IN (SELECT id FROM tasks)"
      ).run();
      orphanedCompletions = r.changes;
    } catch {}

    const total = orphanedMessages + orphanedReads + orphanedReactions + orphanedCompletions;

    return NextResponse.json({
      success: true,
      orphanedMessages,
      orphanedReads,
      orphanedReactions,
      orphanedCompletions,
      total,
    });
  } catch (error) {
    console.error("Orphaned cleanup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
