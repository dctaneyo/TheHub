import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

// task_completions and sessions have no tenantId of their own — scope
// through their parent (tasks.tenant_id) or owning account
// (locations.tenant_id / arls.tenant_id), the same patterns used in
// clear-sessions and purge-old-tasks.
const COMPLETIONS_IN_TENANT = "task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)";
const SESSIONS_IN_TENANT = `(
  (user_type = 'location' AND user_id IN (SELECT id FROM locations WHERE tenant_id = ?))
  OR (user_type = 'arl' AND user_id IN (SELECT id FROM arls WHERE tenant_id = ?))
)`;

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const tenantId = session.tenantId;
    const duplicates: { type: string; description: string; count: number }[] = [];

    // Duplicate conversations (same type + same name) within this tenant
    try {
      const r = sqlite.prepare(
        `SELECT type, name, COUNT(*) as c FROM conversations WHERE tenant_id = ? GROUP BY type, name HAVING c > 1`
      ).all(tenantId) as any[];
      for (const row of r) {
        duplicates.push({
          type: "conversation",
          description: `Duplicate "${row.name}" (${row.type})`,
          count: row.c,
        });
      }
    } catch (e) {
      console.error("Duplicate check conversations error:", e);
    }

    // Duplicate task completions (same task + same location + same date) within this tenant
    try {
      const r = sqlite.prepare(
        `SELECT task_id, location_id, completed_date, COUNT(*) as c
         FROM task_completions
         WHERE ${COMPLETIONS_IN_TENANT}
         GROUP BY task_id, location_id, completed_date
         HAVING c > 1`
      ).all(tenantId) as any[];
      if (r.length > 0) {
        const totalDupes = r.reduce((sum: number, row: any) => sum + (row.c - 1), 0);
        duplicates.push({
          type: "task_completion",
          description: `Duplicate task completions (same task, location, date)`,
          count: totalDupes,
        });
      }
    } catch (e) {
      console.error("Duplicate check task completions error:", e);
    }

    // Duplicate sessions (same user with multiple active sessions) within this tenant
    try {
      const r = sqlite.prepare(
        `SELECT user_id, user_type, COUNT(*) as c
         FROM sessions
         WHERE is_online = 1 AND ${SESSIONS_IN_TENANT}
         GROUP BY user_id, user_type
         HAVING c > 1`
      ).all(tenantId, tenantId) as any[];
      if (r.length > 0) {
        const totalDupes = r.reduce((sum: number, row: any) => sum + (row.c - 1), 0);
        duplicates.push({
          type: "session",
          description: `Users with multiple active sessions`,
          count: totalDupes,
        });
      }
    } catch (e) {
      console.error("Duplicate check sessions error:", e);
    }

    return apiSuccess({
      hasDuplicates: duplicates.length > 0,
      duplicates,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Duplicate check error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request.headers);
    const rl = checkRateLimit(`data-management:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const tenantId = session.tenantId;
    let removedCompletions = 0;
    let removedSessions = 0;

    // Remove duplicate task completions within this tenant (keep the earliest)
    try {
      const r = sqlite.prepare(
        `DELETE FROM task_completions WHERE ${COMPLETIONS_IN_TENANT} AND rowid NOT IN (
          SELECT MIN(rowid) FROM task_completions WHERE ${COMPLETIONS_IN_TENANT} GROUP BY task_id, location_id, completed_date
        )`
      ).run(tenantId, tenantId);
      removedCompletions = r.changes;
    } catch (e) {
      console.error("Remove duplicate completions error:", e);
    }

    // Remove duplicate online sessions within this tenant (keep the newest)
    try {
      const r = sqlite.prepare(
        `DELETE FROM sessions WHERE ${SESSIONS_IN_TENANT} AND rowid NOT IN (
          SELECT MAX(rowid) FROM sessions WHERE ${SESSIONS_IN_TENANT} GROUP BY user_id, user_type
        )`
      ).run(tenantId, tenantId, tenantId, tenantId);
      removedSessions = r.changes;
    } catch (e) {
      console.error("Remove duplicate sessions error:", e);
    }

    return apiSuccess({
      removedCompletions,
      removedSessions,
      total: removedCompletions + removedSessions,
    });
  } catch (error) {
    console.error("Duplicate removal error:", error);
    return ApiErrors.internal();
  }
}
