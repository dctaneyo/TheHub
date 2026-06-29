import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";

// task_completions and sessions have no tenantId of their own — scope
// through their parent (tasks.tenant_id) or owning account
// (locations.tenant_id / arls.tenant_id).
const COMPLETIONS_IN_TENANT = "task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)";
const SESSIONS_IN_TENANT = `(
  (user_type = 'location' AND user_id IN (SELECT id FROM locations WHERE tenant_id = ?))
  OR (user_type = 'arl' AND user_id IN (SELECT id FROM arls WHERE tenant_id = ?))
)`;

// GET — detection only, read-only, no PIN re-confirmation needed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const duplicates: { type: string; description: string; count: number }[] = [];

    try {
      const r = sqlite.prepare(
        `SELECT type, name, COUNT(*) as c FROM conversations WHERE tenant_id = ? GROUP BY type, name HAVING c > 1`
      ).all(tenantId) as any[];
      for (const row of r) {
        duplicates.push({ type: "conversation", description: `Duplicate "${row.name}" (${row.type})`, count: row.c });
      }
    } catch (e) {
      console.error("Duplicate check conversations error:", e);
    }

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
        duplicates.push({ type: "task_completion", description: `Duplicate task completions (same task, location, date)`, count: totalDupes });
      }
    } catch (e) {
      console.error("Duplicate check task completions error:", e);
    }

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
        duplicates.push({ type: "session", description: `Users with multiple active sessions`, count: totalDupes });
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

// POST — removal, irreversible, PIN re-confirmation required.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    let removedCompletions = 0;
    let removedSessions = 0;

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
