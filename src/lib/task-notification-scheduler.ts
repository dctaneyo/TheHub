import { db, schema } from "./db";
import { eq, and } from "drizzle-orm";
import { createNotification, createNotificationBulk } from "./notifications";

/**
 * Real-time task notification scheduler
 *
 * Instead of polling every 5 minutes, this computes the EXACT millisecond
 * each notification should fire and sets precise setTimeout timers.
 *
 * Two timer types per task per location:
 *   - "due-soon": fires exactly 30 minutes before dueTime
 *   - "overdue":  fires exactly at dueTime
 *
 * Timers are recalculated:
 *   - On server startup (for all today's tasks)
 *   - At midnight (for the new day's tasks)
 *   - When refreshTaskTimers() is called (after task CRUD)
 */

const DUE_SOON_MINUTES = 30;

// Active timers: key = "locationId:taskId:due-soon" or "locationId:taskId:overdue"
const _timers = new Map<string, ReturnType<typeof setTimeout>>();

// Midnight rollover timer
let _midnightTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Get current time in Hawaii timezone (server runs on Railway in UTC).
 */
function hawaiiNow(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: "Pacific/Honolulu" });
  return new Date(str);
}

/**
 * Get today's date string in YYYY-MM-DD format (Hawaii time)
 */
function getTodayDate(): string {
  const d = hawaiiNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Convert a "HH:mm" time string to a Date object in Hawaii time for today
 */
function timeToDate(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = hawaiiNow();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Check if a task should run today based on its recurrence settings
 */
function isTaskDueToday(task: any, todayDate: string): boolean {
  // One-time task with specific date
  if (task.dueDate && !task.isRecurring) {
    return task.dueDate === todayDate;
  }
  // Recurring or no dueDate (daily by default)
  if (!task.isRecurring && !task.dueDate) {
    return true; // daily task, always due
  }
  if (task.isRecurring) {
    const today = new Date(todayDate + "T12:00:00");
    const dayIndex = today.getDay(); // 0=Sun, 1=Mon, ...
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const todayName = dayNames[dayIndex];

    if (task.recurringType === "daily") return true;
    if (task.recurringType === "weekly" && task.recurringDays) {
      try {
        const days: string[] = JSON.parse(task.recurringDays);
        return days.includes(todayName);
      } catch {
        return true;
      }
    }
    if (task.recurringType === "biweekly" && task.recurringDays) {
      try {
        const days: string[] = JSON.parse(task.recurringDays);
        if (!days.includes(todayName)) return false;
        // Biweekly logic: check if this is the correct week
        const anchor = task.biweeklyStart === "next" ? 1 : 0;
        const weekNumber = Math.floor((today.getTime() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000));
        return weekNumber % 2 === anchor;
      } catch {
        return true;
      }
    }
    if (task.recurringType === "monthly" && task.recurringDays) {
      try {
        const days: number[] = JSON.parse(task.recurringDays);
        return days.includes(today.getDate());
      } catch {
        return true;
      }
    }
  }
  return true;
}

/**
 * Check if a task is already completed for a location today
 */
function isTaskCompleted(taskId: string, locationId: string, todayDate: string): boolean {
  const completion = db.select()
    .from(schema.taskCompletions)
    .where(
      and(
        eq(schema.taskCompletions.taskId, taskId),
        eq(schema.taskCompletions.locationId, locationId),
        eq(schema.taskCompletions.completedDate, todayDate)
      )
    )
    .get();
  return !!completion;
}

/**
 * Fire a "due soon" notification for a specific task + location
 */
async function fireDueSoon(taskId: string, taskTitle: string, dueTime: string, taskPriority: string, locationId: string, locationName: string) {
  const todayDate = getTodayDate();
  // Re-check completion at fire time (task may have been completed since timer was set)
  if (isTaskCompleted(taskId, locationId, todayDate)) return;

  await createNotification({
    userId: locationId,
    userType: "location",
    type: "task_due_soon",
    title: `Task due soon: ${taskTitle}`,
    message: `Due at ${dueTime} - Complete before time runs out!`,
    actionUrl: "/dashboard",
    actionLabel: "View Tasks",
    priority: "high",
    metadata: { taskId, taskTitle, dueTime, taskPriority },
  });

  console.log(`📋 [EXACT] task_due_soon → ${locationName} — "${taskTitle}" (due ${dueTime})`);
}

/**
 * Fire an "overdue" notification for a specific task + location,
 * plus notify all ARLs about the overdue task.
 */
async function fireOverdue(taskId: string, taskTitle: string, dueTime: string, locationId: string, locationName: string) {
  const todayDate = getTodayDate();
  if (isTaskCompleted(taskId, locationId, todayDate)) return;

  // Notify the location
  await createNotification({
    userId: locationId,
    userType: "location",
    type: "task_overdue",
    title: `OVERDUE: ${taskTitle}`,
    message: `Was due at ${dueTime} - Complete ASAP!`,
    actionUrl: "/dashboard",
    actionLabel: "Complete Now",
    priority: "urgent",
    metadata: { taskId, taskTitle, dueTime, minutesOverdue: 0 },
  });

  // Notify all ARLs
  const allArls = db.select().from(schema.arls).where(eq(schema.arls.isActive, true)).all();
  if (allArls.length > 0) {
    await createNotificationBulk(
      allArls.map((a) => a.id),
      {
        userType: "arl",
        type: "task_overdue_location",
        title: `${locationName}: "${taskTitle}" is now overdue`,
        message: `Was due at ${dueTime} — not yet completed`,
        actionUrl: "/arl?view=tasks",
        actionLabel: "View Tasks",
        priority: "high",
        metadata: { locationId, locationName, overdueCount: 1, overdueTasks: [taskTitle] },
      }
    );
  }

  console.log(`⚠️  [EXACT] task_overdue → ${locationName} — "${taskTitle}" (was due ${dueTime})`);
}

/**
 * Clear all active timers
 */
function clearAllTimers() {
  for (const [key, timer] of _timers) {
    clearTimeout(timer);
  }
  _timers.clear();
}

/**
 * Schedule timers for all of today's tasks across all active locations.
 * This is the core function — it computes exact milliseconds and sets setTimeout.
 */
function scheduleAllForToday() {
  clearAllTimers();

  const now = Date.now();
  const todayDate = getTodayDate();

  const locations = db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).all();

  // Get all non-hidden tasks
  const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.isHidden, false)).all();

  let dueSoonCount = 0;
  let overdueCount = 0;

  for (const location of locations) {
    // Filter tasks for this location (locationId matches or null = all locations)
    const locationTasks = allTasks.filter(
      (t) => !t.locationId || t.locationId === location.id
    );

    for (const task of locationTasks) {
      if (!isTaskDueToday(task, todayDate)) continue;

      const dueDate = timeToDate(todayDate, task.dueTime);
      const dueMs = dueDate.getTime();

      // "Due soon" fires 30 minutes before due time
      const dueSoonMs = dueMs - DUE_SOON_MINUTES * 60 * 1000;
      const dueSoonDelay = dueSoonMs - now;

      if (dueSoonDelay > 0) {
        const key = `${location.id}:${task.id}:due-soon`;
        const timer = setTimeout(
          () => {
            _timers.delete(key);
            fireDueSoon(task.id, task.title, task.dueTime, task.priority, location.id, location.name);
          },
          dueSoonDelay
        );
        _timers.set(key, timer);
        dueSoonCount++;
      }

      // "Overdue" fires exactly at due time
      const overdueDelay = dueMs - now;

      if (overdueDelay > 0) {
        const key = `${location.id}:${task.id}:overdue`;
        const timer = setTimeout(
          () => {
            _timers.delete(key);
            fireOverdue(task.id, task.title, task.dueTime, location.id, location.name);
          },
          overdueDelay
        );
        _timers.set(key, timer);
        overdueCount++;
      }
    }
  }

  console.log(`🔔 Scheduled ${dueSoonCount} due-soon + ${overdueCount} overdue timers for ${todayDate}`);
}

/**
 * Schedule the midnight rollover — at 00:00:01 recalculate all timers for the new day.
 */
function scheduleMidnightRollover() {
  if (_midnightTimer) clearTimeout(_midnightTimer);

  const now = hawaiiNow();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 1, 0); // 00:00:01 Hawaii time

  const delay = tomorrow.getTime() - now.getTime();

  _midnightTimer = setTimeout(() => {
    console.log("🌅 Midnight rollover — recalculating task timers for new day");
    scheduleAllForToday();
    scheduleMidnightRollover(); // schedule next midnight
  }, delay);

  console.log(`🕛 Midnight rollover scheduled in ${Math.round(delay / 60000)} minutes`);
}

/**
 * Public: Refresh timers after task CRUD operations.
 * Call this from API routes when tasks are created, updated, or deleted.
 */
export function refreshTaskTimers() {
  scheduleAllForToday();
}

/**
 * Main entry point — call from server.ts on startup.
 * Sets up precise timers for all of today's remaining tasks
 * and schedules midnight rollover for the next day.
 */
export function startTaskNotificationScheduler() {
  console.log("🔔 Task notification scheduler started (exact-second precision)");
  scheduleAllForToday();
  scheduleMidnightRollover();
}
