import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { logBulkOperation } from "@/lib/audit-logger";
import { refreshTaskTimers } from "@/lib/task-notification-scheduler";
import { v4 as uuid } from "uuid";

// Moved from /api/data-management/bulk-tasks — this is routine tenant
// self-service task work, not a nuclear option, so it stays under the
// ARL's own tenant-scoped session rather than moving to the Admin Console.
// Surfaced as a bulk-actions affordance in Task Manager.
export async function POST(request: Request) {
  try {
    const ip = getClientIP(request.headers);
    const rl = checkRateLimit(`data-management:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.TASKS_EDIT);
    if (denied) return denied;

    const { action, payload } = await request.json();
    const tenantId = session.tenantId;
    // task_completions has no tenantId of its own — scope via the task.
    const completionsInTenant = "task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)";

    let deleted = 0;
    let created = 0;
    let updated = 0;

    switch (action) {
      case "clear-completions-today": {
        const today = new Date().toISOString().split("T")[0];
        const r = sqlite.prepare(
          `DELETE FROM task_completions WHERE completed_date = ? AND ${completionsInTenant}`
        ).run(today, tenantId);
        deleted = r.changes;
        break;
      }
      case "clear-completions-week": {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const r = sqlite.prepare(
          `DELETE FROM task_completions WHERE completed_date >= ? AND ${completionsInTenant}`
        ).run(weekAgo.toISOString().split("T")[0], tenantId);
        deleted = r.changes;
        break;
      }
      case "clear-all-completions": {
        const r = sqlite.prepare(`DELETE FROM task_completions WHERE ${completionsInTenant}`).run(tenantId);
        deleted = r.changes;
        break;
      }

      case "create-tasks-bulk": {
        const { tasks } = payload || {};
        if (!Array.isArray(tasks) || tasks.length === 0) {
          return ApiErrors.badRequest("No tasks provided");
        }

        const insertStmt = sqlite.prepare(`
          INSERT INTO tasks (id, tenant_id, title, description, type, priority, due_time, due_date, is_recurring, recurring_type, recurring_days, biweekly_start, location_id, created_by, created_by_type, is_hidden, allow_early_complete, show_in_today, show_in_7day, show_in_calendar, points, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        const insertMany = sqlite.transaction((taskList: any[]) => {
          for (const task of taskList) {
            insertStmt.run(
              uuid(),
              tenantId,
              task.title,
              task.description || null,
              task.type || "task",
              task.priority || "normal",
              task.dueTime || "09:00",
              task.dueDate || null,
              task.isRecurring ? 1 : 0,
              task.recurringType || null,
              task.recurringDays ? JSON.stringify(task.recurringDays) : null,
              task.biweeklyStart || null,
              task.locationId || null,
              session.id,
              "arl",
              0,
              task.allowEarlyComplete ? 1 : 0,
              task.showInToday !== false ? 1 : 0,
              task.showIn7Day !== false ? 1 : 0,
              task.showInCalendar !== false ? 1 : 0,
              task.points || 10,
              now,
              now
            );
          }
        });

        insertMany(tasks);
        created = tasks.length;
        break;
      }

      case "delete-tasks-bulk": {
        const { taskIds } = payload || {};
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
          return ApiErrors.badRequest("No task IDs provided");
        }

        const placeholders = taskIds.map(() => "?").join(",");

        sqlite.prepare(
          `DELETE FROM task_completions WHERE task_id IN (${placeholders}) AND ${completionsInTenant}`
        ).run(...taskIds, tenantId);

        const r = sqlite.prepare(
          `DELETE FROM tasks WHERE id IN (${placeholders}) AND tenant_id = ?`
        ).run(...taskIds, tenantId);
        deleted = r.changes;
        break;
      }

      case "update-tasks-bulk": {
        const { taskIds, updates } = payload || {};
        if (!Array.isArray(taskIds) || taskIds.length === 0 || !updates) {
          return ApiErrors.badRequest("Task IDs and updates required");
        }

        const setClauses: string[] = [];
        const setParams: any[] = [];

        if (updates.priority !== undefined) { setClauses.push("priority = ?"); setParams.push(updates.priority); }
        if (updates.isHidden !== undefined) { setClauses.push("is_hidden = ?"); setParams.push(updates.isHidden ? 1 : 0); }
        if (updates.points !== undefined) { setClauses.push("points = ?"); setParams.push(updates.points); }
        if (updates.showInToday !== undefined) { setClauses.push("show_in_today = ?"); setParams.push(updates.showInToday ? 1 : 0); }
        if (updates.showIn7Day !== undefined) { setClauses.push("show_in_7day = ?"); setParams.push(updates.showIn7Day ? 1 : 0); }
        if (updates.showInCalendar !== undefined) { setClauses.push("show_in_calendar = ?"); setParams.push(updates.showInCalendar ? 1 : 0); }

        if (setClauses.length === 0) {
          return ApiErrors.badRequest("No valid updates provided");
        }

        setClauses.push("updated_at = ?");
        setParams.push(new Date().toISOString());

        const placeholdersUpdate = taskIds.map(() => "?").join(",");
        const r = sqlite.prepare(
          `UPDATE tasks SET ${setClauses.join(", ")} WHERE id IN (${placeholdersUpdate}) AND tenant_id = ?`
        ).run(...setParams, ...taskIds, tenantId);
        updated = r.changes;
        break;
      }

      default:
        return ApiErrors.badRequest("Invalid action");
    }

    logBulkOperation({
      tenantId: session.tenantId,
      userId: session.id,
      userType: session.userType,
      operation: action,
      entityType: "tasks",
      affectedCount: deleted + created + updated,
      payload: payload || { action },
      status: "success",
    });

    refreshTaskTimers();

    return apiSuccess({ deleted, created, updated, action });
  } catch (error) {
    console.error("Bulk tasks error:", error);
    return ApiErrors.internal();
  }
}
