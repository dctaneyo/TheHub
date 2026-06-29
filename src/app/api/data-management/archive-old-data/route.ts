import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
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

    const { dataType, daysOld } = await request.json();
    const tenantId = session.tenantId;

    // Create archive tables if they don't exist
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS archived_messages (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          conversation_id TEXT,
          sender_type TEXT,
          sender_id TEXT,
          sender_name TEXT,
          content TEXT,
          message_type TEXT,
          created_at TEXT,
          archived_at TEXT
        )
      `);
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS archived_task_completions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          task_id TEXT,
          location_id TEXT,
          completed_at TEXT,
          completed_date TEXT,
          notes TEXT,
          points_earned INTEGER,
          bonus_points INTEGER,
          archived_at TEXT
        )
      `);
    } catch (e) {
      console.error("Archive table creation error:", e);
    }
    // These two tables predate tenant scoping — add the column to any
    // pre-existing archive table that was created before this change.
    // ALTER TABLE ADD COLUMN fails (harmlessly) if the column already exists.
    try { sqlite.exec(`ALTER TABLE archived_messages ADD COLUMN tenant_id TEXT`); } catch { /* already has the column */ }
    try { sqlite.exec(`ALTER TABLE archived_task_completions ADD COLUMN tenant_id TEXT`); } catch { /* already has the column */ }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (daysOld || 180));
    const cutoff = cutoffDate.toISOString();
    const archivedAt = new Date().toISOString();

    let archived = 0;

    if (dataType === "messages") {
      // Messages have no tenantId of their own — scope via their conversation's.
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
      // task_completions have no tenantId of their own — scope via the task.
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

    logAudit({ tenantId: session.tenantId, userId: session.id, userType: session.userType, operation: "archive", entityType: dataType, affectedCount: archived, payload: { cutoffDate: cutoff, daysOld }, status: "success" });

    return apiSuccess({
      archived,
      dataType,
      cutoffDate: cutoff,
      daysOld,
    });
  } catch (error) {
    console.error("Archive old data error:", error);
    return ApiErrors.internal();
  }
}

// Get archive statistics
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const tenantId = session.tenantId;
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
