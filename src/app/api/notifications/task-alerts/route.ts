import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getTenantTimezone, getLocationTimezone, tzTodayStr } from "@/lib/timezone";

/**
 * GET /api/notifications/task-alerts
 *
 * Returns today's task_due_soon and task_overdue DB notifications for the
 * current location.  The dashboard NotificationSystem uses this on mount to
 * seed its "already-fired" set so notifications don't reappear after refresh.
 *
 * Response: { alerts: Array<{ dbId, clientId, type, taskId, title, dueTime, isRead }> }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    // Today in the user's timezone (location override → tenant default)
    const todayDate = tzTodayStr(
      session.userType === "location" ? getLocationTimezone(session.id) : getTenantTimezone(session.tenantId)
    );

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        metadata: notifications.metadata,
        isRead: notifications.isRead,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.id),
          sql`${notifications.type} IN ('task_due_soon', 'task_overdue')`,
          sql`${notifications.createdAt} >= ${todayDate}`
        )
      );

    const alerts = rows.map((row) => {
      let taskId = "";
      let title = "";
      let dueTime = "";
      try {
        const meta = row.metadata ? JSON.parse(row.metadata) : {};
        taskId = meta.taskId || "";
        title = meta.taskTitle || meta.title || "";
        dueTime = meta.dueTime || "";
      } catch (e) {
        console.error("Failed to parse task alert metadata:", e);
      }

      const clientId =
        row.type === "task_due_soon"
          ? `due-${taskId}`
          : `overdue-${taskId}`;

      return {
        dbId: row.id,
        clientId,
        type: row.type === "task_due_soon" ? "due_soon" : "overdue",
        taskId,
        title,
        dueTime,
        isRead: row.isRead,
      };
    });

    return apiSuccess({ alerts });
  } catch (error) {
    console.error("Error fetching task alerts:", error);
    return ApiErrors.internal();
  }
}

/**
 * POST /api/notifications/task-alerts
 *
 * Mark one or more task alert DB notifications as read (dismissed).
 * Body: { dbIds?: string[], clientIds?: string[] }
 *
 * clientIds are in the format "due-{taskId}" or "overdue-{taskId}".
 * They are resolved server-side by querying today's notifications and
 * matching metadata.taskId + type, so dismissals always persist even when
 * the client doesn't know the DB notification ID (e.g. socket-pushed alerts).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await req.json();
    const dbIds: string[] = body.dbIds || [];
    const clientIds: string[] = body.clientIds || [];

    if (dbIds.length === 0 && clientIds.length === 0) {
      return ApiErrors.badRequest("dbIds or clientIds required");
    }

    const now = new Date().toISOString();
    const idsToMark = new Set<string>(dbIds);

    // Resolve clientIds → DB notification IDs by querying today's alerts
    if (clientIds.length > 0) {
      const alertDate = tzTodayStr(
        session.userType === "location" ? getLocationTimezone(session.id) : getTenantTimezone(session.tenantId)
      );

      const rows = db
        .select({ id: notifications.id, type: notifications.type, metadata: notifications.metadata })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, session.id),
            sql`${notifications.type} IN ('task_due_soon', 'task_overdue')`,
            sql`${notifications.createdAt} >= ${alertDate}`
          )
        )
        .all();

      // Build a set of requested clientIds for fast lookup
      const requestedClientIds = new Set(clientIds);

      for (const row of rows) {
        try {
          const meta = row.metadata ? JSON.parse(row.metadata) : {};
          const taskId = meta.taskId || "";
          const cid = row.type === "task_due_soon" ? `due-${taskId}` : `overdue-${taskId}`;
          if (requestedClientIds.has(cid)) {
            idsToMark.add(row.id);
          }
        } catch (e) {
          console.error("Failed to parse task alert metadata for dismiss:", e);
        }
      }
    }

    // Mark all resolved DB notifications as read
    for (const dbId of idsToMark) {
      db.update(notifications)
        .set({ isRead: true, readAt: now })
        .where(and(eq(notifications.id, dbId), eq(notifications.userId, session.id)))
        .run();
    }

    return apiSuccess({ dismissed: idsToMark.size });
  } catch (error) {
    console.error("Error dismissing task alerts:", error);
    return ApiErrors.internal();
  }
}
