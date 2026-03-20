import type { Server as SocketIOServer } from "socket.io";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { createNotification, upgradeDueSoonToOverdue } from "../notifications";
import { taskTimers } from "./state";
import { taskAppliesToDate } from "../task-utils";
import { getLocationTimezone, tzNow, tzTodayStr, tzDayOfWeek } from "../timezone";

// ── Timezone-aware helpers ──
// The server runs on Railway (UTC). Each tenant has its own IANA timezone.

export function todayStr(tz = "Pacific/Honolulu"): string {
  return tzTodayStr(tz);
}

function dayOfWeek(tz = "Pacific/Honolulu"): string {
  return tzDayOfWeek(tz);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function taskAppliesToToday(task: typeof schema.tasks.$inferSelect, tz = "Pacific/Honolulu"): boolean {
  const today = todayStr(tz);
  const dow = dayOfWeek(tz);
  const date = tzNow(tz);
  date.setHours(12, 0, 0, 0);
  return taskAppliesToDate(task, date, today, dow, false);
}

/**
 * Schedule due-soon and overdue task notification timers for a specific location.
 * Fires exact-second setTimeout timers that emit socket events directly to the location.
 */
export function scheduleTaskNotifications(io: SocketIOServer, locationId: string) {
  // Cancel existing timers for this location
  const existing = taskTimers.get(locationId) || [];
  existing.forEach(clearTimeout);
  taskTimers.set(locationId, []);

  try {
    // Look up the location's timezone (location override → tenant default)
    const tz = getLocationTimezone(locationId);

    const allTasks = db.select().from(schema.tasks).all();
    const today = todayStr(tz);
    const completions = db.select({ taskId: schema.taskCompletions.taskId })
      .from(schema.taskCompletions)
      .where(and(eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, today)))
      .all();
    const completedIds = new Set(completions.map((c) => c.taskId));

    const todayTasks = allTasks.filter((t) =>
      (!t.locationId || t.locationId === locationId) &&
      !completedIds.has(t.id) &&
      taskAppliesToToday(t, tz)
    );

    const now = tzNow(tz);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const task of todayTasks) {
      const taskMinutes = timeToMinutes(task.dueTime);

      // Due-soon: 30 minutes before due time
      const dueSoonMinutes = taskMinutes - 30;
      const msUntilDueSoon = (dueSoonMinutes - nowMinutes) * 60 * 1000 - now.getSeconds() * 1000;
      if (msUntilDueSoon > 0) {
        timers.push(setTimeout(() => {
          const c = db.select({ id: schema.taskCompletions.id }).from(schema.taskCompletions)
            .where(and(eq(schema.taskCompletions.taskId, task.id), eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, todayStr(tz))))
            .get();
          if (!c) {
            io.to(`location:${locationId}`).emit("task:due-soon", { taskId: task.id, title: task.title, dueTime: task.dueTime, points: task.points });
            createNotification({
              userId: locationId,
              userType: "location",
              type: "task_due_soon",
              title: `Due soon: ${task.title}`,
              message: `Task "${task.title}" is due at ${task.dueTime}`,
              priority: "high",
              metadata: { taskId: task.id, dueTime: task.dueTime },
            }).catch(() => {});
          }
        }, msUntilDueSoon));
      }

      // Overdue: exactly at due time
      const msUntilOverdue = (taskMinutes - nowMinutes) * 60 * 1000 - now.getSeconds() * 1000;
      if (msUntilOverdue > 0) {
        timers.push(setTimeout(async () => {
          const c = db.select({ id: schema.taskCompletions.id }).from(schema.taskCompletions)
            .where(and(eq(schema.taskCompletions.taskId, task.id), eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, todayStr(tz))))
            .get();
          if (!c) {
            io.to(`location:${locationId}`).emit("task:overdue", { taskId: task.id, title: task.title, dueTime: task.dueTime, points: task.points });
            // Try to upgrade existing due-soon notification instead of creating a duplicate
            const overdueTitle = `Overdue: ${task.title}`;
            const overdueMsg = `Task "${task.title}" was due at ${task.dueTime}`;
            try {
              const upgraded = await upgradeDueSoonToOverdue(locationId, task.id, overdueTitle, overdueMsg);
              if (!upgraded) {
                // No due-soon notification existed — create a fresh overdue notification
                await createNotification({
                  userId: locationId,
                  userType: "location",
                  type: "task_overdue",
                  title: overdueTitle,
                  message: overdueMsg,
                  priority: "urgent",
                  metadata: { taskId: task.id, dueTime: task.dueTime },
                });
              }
            } catch {}
          }
        }, msUntilOverdue));
      }
    }

    taskTimers.set(locationId, timers);
    console.log(`⏰ Scheduled ${timers.length} task notification timers for location ${locationId}`);
  } catch (err) {
    console.error("scheduleTaskNotifications error:", err);
  }
}

/**
 * Cancel all task notification timers for a location (on disconnect).
 */
export function cancelTaskTimers(locationId: string) {
  const timers = taskTimers.get(locationId) || [];
  timers.forEach(clearTimeout);
  taskTimers.delete(locationId);
}
