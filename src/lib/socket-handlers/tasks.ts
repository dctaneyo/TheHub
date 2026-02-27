import type { Server as SocketIOServer } from "socket.io";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { createNotification } from "../notifications";
import { taskTimers } from "./state";

// ── Hawaii timezone helpers ──
// The server runs on Railway (UTC) but all tasks are in Hawaii local time.

export function hawaiiNow(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: "Pacific/Honolulu" });
  return new Date(str);
}

export function todayStr(): string {
  const d = hawaiiNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayOfWeek(): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][hawaiiNow().getDay()];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function taskAppliesToToday(task: typeof schema.tasks.$inferSelect): boolean {
  const today = todayStr();
  const dow = dayOfWeek();
  if (task.isHidden || !task.showInToday) return false;
  if (!task.isRecurring) return task.dueDate === today;
  if (task.isRecurring && task.createdAt) {
    if (today < task.createdAt.split("T")[0]) return false;
  }
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly" || rType === "biweekly") {
    if (!task.recurringDays) return false;
    try {
      const days = JSON.parse(task.recurringDays) as string[];
      if (!days.includes(dow)) return false;
      if (rType === "biweekly") {
        const anchor = task.createdAt ? new Date(task.createdAt) : new Date(0);
        const anchorMon = new Date(anchor);
        const ad = anchorMon.getDay();
        anchorMon.setDate(anchorMon.getDate() + (ad === 0 ? -6 : 1 - ad));
        anchorMon.setHours(0, 0, 0, 0);
        const hiNow = hawaiiNow(); hiNow.setHours(0, 0, 0, 0);
        const nd = hiNow.getDay();
        const nowMon = new Date(hiNow);
        nowMon.setDate(nowMon.getDate() + (nd === 0 ? -6 : 1 - nd));
        const weeksDiff = Math.round((nowMon.getTime() - anchorMon.getTime()) / (7 * 86400000));
        const isEven = weeksDiff % 2 === 0;
        return (task as any).biweeklyStart === "next" ? !isEven : isEven;
      }
      return true;
    } catch { return false; }
  }
  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as number[]).includes(hawaiiNow().getDate()); } catch { return false; }
  }
  return false;
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
    const allTasks = db.select().from(schema.tasks).all();
    const today = todayStr();
    const completions = db.select({ taskId: schema.taskCompletions.taskId })
      .from(schema.taskCompletions)
      .where(and(eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, today)))
      .all();
    const completedIds = new Set(completions.map((c) => c.taskId));

    const todayTasks = allTasks.filter((t) =>
      (!t.locationId || t.locationId === locationId) &&
      !completedIds.has(t.id) &&
      taskAppliesToToday(t)
    );

    const now = hawaiiNow();
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
            .where(and(eq(schema.taskCompletions.taskId, task.id), eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, todayStr())))
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
        timers.push(setTimeout(() => {
          const c = db.select({ id: schema.taskCompletions.id }).from(schema.taskCompletions)
            .where(and(eq(schema.taskCompletions.taskId, task.id), eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, todayStr())))
            .get();
          if (!c) {
            io.to(`location:${locationId}`).emit("task:overdue", { taskId: task.id, title: task.title, dueTime: task.dueTime, points: task.points });
            createNotification({
              userId: locationId,
              userType: "location",
              type: "task_overdue",
              title: `Overdue: ${task.title}`,
              message: `Task "${task.title}" was due at ${task.dueTime}`,
              priority: "urgent",
              metadata: { taskId: task.id, dueTime: task.dueTime },
            }).catch(() => {});
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
