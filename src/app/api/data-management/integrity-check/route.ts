import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const issues: { table: string; issue: string; count: number }[] = [];

    // Check messages without conversations
    try {
      const r = sqlite.prepare(
        "SELECT COUNT(*) as c FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)"
      ).get() as any;
      if (r.c > 0) issues.push({ table: "messages", issue: "Messages without conversations", count: r.c });
    } catch {}

    // Check message_reads without messages
    try {
      const r = sqlite.prepare(
        "SELECT COUNT(*) as c FROM message_reads WHERE message_id NOT IN (SELECT id FROM messages)"
      ).get() as any;
      if (r.c > 0) issues.push({ table: "message_reads", issue: "Read receipts without messages", count: r.c });
    } catch {}

    // Check message_reactions without messages
    try {
      const r = sqlite.prepare(
        "SELECT COUNT(*) as c FROM message_reactions WHERE message_id NOT IN (SELECT id FROM messages)"
      ).get() as any;
      if (r.c > 0) issues.push({ table: "message_reactions", issue: "Reactions without messages", count: r.c });
    } catch {}

    // Check task_completions without tasks
    try {
      const r = sqlite.prepare(
        "SELECT COUNT(*) as c FROM task_completions WHERE task_id NOT IN (SELECT id FROM tasks)"
      ).get() as any;
      if (r.c > 0) issues.push({ table: "task_completions", issue: "Completions without tasks", count: r.c });
    } catch {}

    // Check sessions without users
    try {
      const r = sqlite.prepare(
        "SELECT COUNT(*) as c FROM sessions WHERE user_type = 'location' AND user_id NOT IN (SELECT id FROM locations)"
      ).get() as any;
      if (r.c > 0) issues.push({ table: "sessions", issue: "Location sessions without locations", count: r.c });
    } catch {}

    try {
      const r = sqlite.prepare(
        "SELECT COUNT(*) as c FROM sessions WHERE user_type = 'arl' AND user_id NOT IN (SELECT id FROM arls)"
      ).get() as any;
      if (r.c > 0) issues.push({ table: "sessions", issue: "ARL sessions without ARLs", count: r.c });
    } catch {}

    // SQLite integrity check
    let integrityOk = true;
    try {
      const r = sqlite.prepare("PRAGMA integrity_check").get() as any;
      integrityOk = r?.integrity_check === "ok";
    } catch {}

    return NextResponse.json({
      healthy: issues.length === 0 && integrityOk,
      integrityOk,
      issues,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Integrity check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
