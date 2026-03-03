import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

    // Today in Hawaii time (server may run in UTC)
    const hawaiiDate = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Honolulu" }); // YYYY-MM-DD

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
          sql`${notifications.createdAt} >= ${hawaiiDate}`
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
      } catch {}

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

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error fetching task alerts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/notifications/task-alerts
 *
 * Mark one or more task alert DB notifications as read (dismissed).
 * Body: { dbIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { dbIds } = await req.json();
    if (!Array.isArray(dbIds) || dbIds.length === 0) {
      return NextResponse.json({ error: "dbIds required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    for (const dbId of dbIds) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(and(eq(notifications.id, dbId), eq(notifications.userId, session.id)));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing task alerts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
