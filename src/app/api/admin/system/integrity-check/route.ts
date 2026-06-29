import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";

// Moved from /api/data-management/integrity-check — whole-database
// diagnostics, never tenant-scoped. Read-only, admin-session-gated.
export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const issues: { table: string; issue: string; count: number }[] = [];

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)").get() as any;
      if (r.c > 0) issues.push({ table: "messages", issue: "Messages without conversations", count: r.c });
    } catch (err) { console.error("Integrity check: messages query failed:", err); }

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM message_reads WHERE message_id NOT IN (SELECT id FROM messages)").get() as any;
      if (r.c > 0) issues.push({ table: "message_reads", issue: "Read receipts without messages", count: r.c });
    } catch (err) { console.error("Integrity check: message_reads query failed:", err); }

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM message_reactions WHERE message_id NOT IN (SELECT id FROM messages)").get() as any;
      if (r.c > 0) issues.push({ table: "message_reactions", issue: "Reactions without messages", count: r.c });
    } catch (err) { console.error("Integrity check: message_reactions query failed:", err); }

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM task_completions WHERE task_id NOT IN (SELECT id FROM tasks)").get() as any;
      if (r.c > 0) issues.push({ table: "task_completions", issue: "Completions without tasks", count: r.c });
    } catch (err) { console.error("Integrity check: task_completions query failed:", err); }

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM sessions WHERE user_type = 'location' AND user_id NOT IN (SELECT id FROM locations)").get() as any;
      if (r.c > 0) issues.push({ table: "sessions", issue: "Location sessions without locations", count: r.c });
    } catch (err) { console.error("Integrity check: location sessions query failed:", err); }

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM sessions WHERE user_type = 'arl' AND user_id NOT IN (SELECT id FROM arls)").get() as any;
      if (r.c > 0) issues.push({ table: "sessions", issue: "ARL sessions without ARLs", count: r.c });
    } catch (err) { console.error("Integrity check: arl sessions query failed:", err); }

    let integrityOk = true;
    try {
      const r = sqlite.prepare("PRAGMA integrity_check").get() as any;
      integrityOk = r?.integrity_check === "ok";
    } catch (err) { console.error("Integrity check: PRAGMA failed:", err); }

    return apiSuccess({
      healthy: issues.length === 0 && integrityOk,
      integrityOk,
      issues,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Integrity check error:", error);
    return ApiErrors.internal();
  }
}
