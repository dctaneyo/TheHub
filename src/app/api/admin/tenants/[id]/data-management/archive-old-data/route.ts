import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// POST — archive (irreversible move, PIN re-confirmation required)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { dataType, daysOld, pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS archived_messages (
          id TEXT PRIMARY KEY, tenant_id TEXT, conversation_id TEXT, sender_type TEXT,
          sender_id TEXT, sender_name TEXT, content TEXT, message_type TEXT,
          created_at TEXT, archived_at TEXT
        )
      `);
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS archived_task_completions (
          id TEXT PRIMARY KEY, tenant_id TEXT, task_id TEXT, location_id TEXT,
          completed_at TEXT, completed_date TEXT, notes TEXT,
          points_earned INTEGER, bonus_points INTEGER, archived_at TEXT
        )
      `);
    } catch (e) {
      console.error("Archive table creation error:", e);
    }
    try { sqlite.exec(`ALTER TABLE archived_messages ADD COLUMN tenant_id TEXT`); } catch { /* already has the column */ }
    try { sqlite.exec(`ALTER TABLE archived_task_completions ADD COLUMN tenant_id TEXT`); } catch { /* already has the column */ }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (daysOld || 180));
    const cutoff = cutoffDate.toISOString();
    const archivedAt = new Date().toISOString();

    let archived = 0;

    if (dataType === "messages") {
      sqlite.prepare(`
        INSERT INTO archived_messages
        SELECT id, ? as tenant_id, conversation_id, sender_type, sender_id, sender_name, content, message_type, created_at, ? as archived_at
        FROM messages
        WHERE created_at < ? AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)
      `).run(tenantId, archivedAt, cutoff, tenantId);

      const deleted = sqlite.prepare(
        "DELETE FROM messages WHERE created_at < ? AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)"
      ).run(cutoff, tenantId);
      archived = deleted.changes;
    } else if (dataType === "task-completions") {
      sqlite.prepare(`
        INSERT INTO archived_task_completions
        SELECT id, ? as tenant_id, task_id, location_id, completed_at, completed_date, notes, points_earned, bonus_points, ? as archived_at
        FROM task_completions
        WHERE completed_date < ? AND task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)
      `).run(tenantId, archivedAt, cutoff.split("T")[0], tenantId);

      const deleted = sqlite.prepare(
        "DELETE FROM task_completions WHERE completed_date < ? AND task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)"
      ).run(cutoff.split("T")[0], tenantId);
      archived = deleted.changes;
    } else {
      return ApiErrors.badRequest("Invalid data type");
    }

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "archive", entityType: dataType, affectedCount: archived, payload: { cutoffDate: cutoff, daysOld }, status: "success" });

    return apiSuccess({ archived, dataType, cutoffDate: cutoff, daysOld });
  } catch (error) {
    console.error("Archive old data error:", error);
    return ApiErrors.internal();
  }
}

// GET — archive statistics, read-only, no PIN re-confirmation needed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    let archivedMessages = 0;
    let archivedCompletions = 0;

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM archived_messages WHERE tenant_id = ?").get(tenantId) as { c: number } | undefined;
      archivedMessages = r?.c || 0;
    } catch (e) {
      console.error("Count archived messages error:", e);
    }

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM archived_task_completions WHERE tenant_id = ?").get(tenantId) as { c: number } | undefined;
      archivedCompletions = r?.c || 0;
    } catch (e) {
      console.error("Count archived task completions error:", e);
    }

    return apiSuccess({
      archivedMessages,
      archivedCompletions,
      total: archivedMessages + archivedCompletions,
    });
  } catch (error) {
    console.error("Get archive stats error:", error);
    return ApiErrors.internal();
  }
}
