import { db, schema } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { createNotification, createNotificationBulk } from "./notifications";
import { tzNow, tzTodayStr, tzDayOfWeek } from "./timezone";
import { taskAppliesToDate } from "./task-utils";
import { parseJsonColumn } from "./json-column";

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
 *   - Every SAFETY_SWEEP_MINUTES, as a backstop (see startTaskNotificationScheduler)
 *
 * In-memory timers don't survive a process restart, so every reschedule
 * (not just at midnight) checks for windows that have ALREADY started —
 * if a task is currently due-soon/overdue and that notification was never
 * sent today (checked against the notifications table, not memory), it
 * fires immediately instead of being silently skipped. This is what keeps
 * exact-second precision for the normal case while still being correct
 * after a restart: the schedule is re-derived from the DB every time, not
 * carried only in memory.
 *
 * This deliberately stays in-process (no Redis/durable queue) rather than
 * a polled delay-queue. That's the right tradeoff for a single server
 * instance; it stops being correct the moment this runs on more than one
 * instance at once (each instance would independently schedule and fire
 * the same notifications — duplicates, not gaps). If that ever happens,
 * this needs the durable-queue rearchitecture, not another patch here.
 */

const DUE_SOON_MINUTES = 30;

// Backstop interval — re-derives the schedule from the DB even if nothing
// else triggered a reschedule (defense in depth alongside startup/midnight/
// refreshTaskTimers; cheap since scheduleAllForToday() is idempotent).
const SAFETY_SWEEP_MINUTES = 5;

// Active timers: key = "locationId:taskId:due-soon" or "locationId:taskId:overdue"
const _timers = new Map<string, ReturnType<typeof setTimeout>>();

// Midnight rollover timer
let _midnightTimer: ReturnType<typeof setTimeout> | null = null;

// Periodic safety-sweep interval
let _safetyInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get current time in the given IANA timezone (server runs on Railway in UTC).
 */
function localNow(tz: string): Date {
  return tzNow(tz);
}

/**
 * Get today's date string in YYYY-MM-DD format for the given timezone.
 */
function getTodayDate(tz: string): string {
  return tzTodayStr(tz);
}

/**
 * Convert a "HH:mm" time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Check if a task should run today based on its recurrence settings.
 * Delegates to the shared taskAppliesToDate() in task-utils.ts which
 * correctly handles biweekly anchor-based week counting.
 */
function isTaskDueToday(task: any, todayDate: string, tz: string): boolean {
  const date = new Date(todayDate + "T12:00:00");
  const dayOfWeek = tzDayOfWeek(tz);
  return taskAppliesToDate(task, date, todayDate, dayOfWeek, false);
}

/**
 * Build a set of "locationId:taskId:type" keys already notified today, by
 * querying the notifications table (the durable record) rather than
 * trusting in-memory timer state — this is what makes the catch-up check
 * in scheduleAllForToday() idempotent across restarts and repeated
 * refreshTaskTimers() calls within the same day.
 */
function getAlreadyNotifiedToday(todayDate: string): Set<string> {
  const rows = db.select({
    userId: schema.notifications.userId,
    type: schema.notifications.type,
    metadata: schema.notifications.metadata,
  })
    .from(schema.notifications)
    .where(and(
      eq(schema.notifications.userType, "location"),
      sql`${schema.notifications.type} IN ('task_due_soon', 'task_overdue')`,
      sql`${schema.notifications.createdAt} >= ${todayDate}`
    ))
    .all();

  const seen = new Set<string>();
  for (const row of rows) {
    const taskId = parseJsonColumn<{ taskId?: string }>(row.metadata, {}).taskId;
    if (taskId) seen.add(`${row.userId}:${taskId}:${row.type}`);
  }
  return seen;
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
async function fireDueSoon(taskId: string, taskTitle: string, dueTime: string, taskPriority: string, locationId: string, locationName: string, tz: string) {
  const todayDate = getTodayDate(tz);
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
async function fireOverdue(taskId: string, taskTitle: string, dueTime: string, locationId: string, locationName: string, tz: string) {
  const todayDate = getTodayDate(tz);
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
 * Each location resolves its own timezone (location override → tenant default).
 */
function scheduleAllForToday() {
  clearAllTimers();

  const allLocations = db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).all();
  const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.isHidden, false)).all();

  // Pre-fetch tenant timezones for fallback
  const tenantTzMap = new Map<string, string>();
  const allTenants = db.select({ id: schema.tenants.id, timezone: schema.tenants.timezone })
    .from(schema.tenants).where(eq(schema.tenants.isActive, true)).all();
  for (const t of allTenants) tenantTzMap.set(t.id, t.timezone || "Pacific/Honolulu");

  let dueSoonCount = 0;
  let overdueCount = 0;
  let caughtUpCount = 0;

  // Per-distinct-date cache — most locations share a timezone/date, no
  // need to re-query the notifications table for each one individually.
  const notifiedCache = new Map<string, Set<string>>();
  const getNotified = (todayDate: string) => {
    let set = notifiedCache.get(todayDate);
    if (!set) {
      set = getAlreadyNotifiedToday(todayDate);
      notifiedCache.set(todayDate, set);
    }
    return set;
  };

  for (const location of allLocations) {
    const tz = location.timezone || tenantTzMap.get(location.tenantId) || "Pacific/Honolulu";
    const todayDate = getTodayDate(tz);
    const now = localNow(tz);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowSeconds = now.getSeconds();
    const alreadyNotified = getNotified(todayDate);

    const locationTasks = allTasks.filter(
      (t) => t.tenantId === location.tenantId && (!t.locationId || t.locationId === location.id)
    );

    for (const task of locationTasks) {
      if (!isTaskDueToday(task, todayDate, tz)) continue;

      const taskMinutes = timeToMinutes(task.dueTime);

      const dueSoonMinutes = taskMinutes - DUE_SOON_MINUTES;
      const dueSoonDelay = (dueSoonMinutes - nowMinutes) * 60 * 1000 - nowSeconds * 1000;
      const overdueDelay = (taskMinutes - nowMinutes) * 60 * 1000 - nowSeconds * 1000;

      if (overdueDelay > 0) {
        // Not yet due — schedule the normal future timers.
        if (dueSoonDelay > 0) {
          const key = `${location.id}:${task.id}:due-soon`;
          const timer = setTimeout(
            () => {
              _timers.delete(key);
              fireDueSoon(task.id, task.title, task.dueTime, task.priority, location.id, location.name, tz);
            },
            dueSoonDelay
          );
          _timers.set(key, timer);
          dueSoonCount++;
        } else if (!alreadyNotified.has(`${location.id}:${task.id}:task_due_soon`)) {
          // Due-soon window already started (but task isn't overdue yet)
          // and we restarted/rescheduled since then — catch up now instead
          // of silently losing this notification until the next due date.
          fireDueSoon(task.id, task.title, task.dueTime, task.priority, location.id, location.name, tz);
          caughtUpCount++;
        }

        const key = `${location.id}:${task.id}:overdue`;
        const timer = setTimeout(
          () => {
            _timers.delete(key);
            fireOverdue(task.id, task.title, task.dueTime, location.id, location.name, tz);
          },
          overdueDelay
        );
        _timers.set(key, timer);
        overdueCount++;
      } else if (!alreadyNotified.has(`${location.id}:${task.id}:task_overdue`)) {
        // Already overdue and we missed sending it (process was down,
        // or this is the first reschedule since the due time passed).
        // Due-soon is moot at this point — just catch up the overdue alert.
        fireOverdue(task.id, task.title, task.dueTime, location.id, location.name, tz);
        caughtUpCount++;
      }
    }
  }

  console.log(`🔔 Scheduled ${dueSoonCount} due-soon + ${overdueCount} overdue timers${caughtUpCount > 0 ? ` (${caughtUpCount} caught up immediately)` : ""}`);
}

/**
 * Schedule the midnight rollover — at 00:00:01 (earliest timezone across all locations) recalculate all timers.
 */
function scheduleMidnightRollover() {
  if (_midnightTimer) clearTimeout(_midnightTimer);

  // Collect all unique timezones across locations and tenants
  const tzSet = new Set<string>();
  const allLocations = db.select({ timezone: schema.locations.timezone, tenantId: schema.locations.tenantId })
    .from(schema.locations).where(eq(schema.locations.isActive, true)).all();
  const allTenants = db.select({ id: schema.tenants.id, timezone: schema.tenants.timezone })
    .from(schema.tenants).where(eq(schema.tenants.isActive, true)).all();
  const tenantTzMap = new Map<string, string>();
  for (const t of allTenants) {
    const tz = t.timezone || "Pacific/Honolulu";
    tenantTzMap.set(t.id, tz);
    tzSet.add(tz);
  }
  for (const loc of allLocations) {
    tzSet.add(loc.timezone || tenantTzMap.get(loc.tenantId) || "Pacific/Honolulu");
  }

  let minDelay = Infinity;
  for (const tz of tzSet) {
    const now = localNow(tz);
    const nowTotalSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const midnightSecs = 24 * 3600 + 1; // 00:00:01 next day
    const delay = (midnightSecs - nowTotalSecs) * 1000;
    if (delay < minDelay) minDelay = delay;
  }

  // Fallback if no locations/tenants
  if (!isFinite(minDelay)) {
    const now = localNow("Pacific/Honolulu");
    const nowTotalSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    minDelay = (24 * 3600 + 1 - nowTotalSecs) * 1000;
  }

  _midnightTimer = setTimeout(() => {
    console.log("🌅 Midnight rollover — recalculating task timers for new day");
    scheduleAllForToday();
    scheduleMidnightRollover(); // schedule next midnight
  }, minDelay);

  console.log(`🕛 Midnight rollover scheduled in ${Math.round(minDelay / 60000)} minutes`);
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
  try {
    scheduleAllForToday();
    scheduleMidnightRollover();
  } catch (err) {
    console.error("🔔 Task notification scheduler failed to start (will retry at next midnight):", err);
    // Schedule a retry so the server doesn't stay broken forever
    const fallbackDelay = 60 * 60 * 1000; // 1 hour
    _midnightTimer = setTimeout(() => {
      console.log("🔔 Retrying task notification scheduler...");
      try { scheduleAllForToday(); scheduleMidnightRollover(); } catch (e) { console.error("🔔 Retry failed:", e); }
    }, fallbackDelay);
  }

  if (_safetyInterval) clearInterval(_safetyInterval);
  _safetyInterval = setInterval(() => {
    try {
      scheduleAllForToday();
    } catch (err) {
      console.error("🔔 Safety sweep failed:", err);
    }
  }, SAFETY_SWEEP_MINUTES * 60 * 1000);
}
