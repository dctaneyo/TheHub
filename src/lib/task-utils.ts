/**
 * Shared task recurrence utilities.
 *
 * Single source of truth for "does this task apply to a given date?"
 * Used by leaderboard, gamification, today's tasks, upcoming tasks,
 * and the real-time task notification scheduler.
 */

/** Returns the Monday of the week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

export interface TaskRecurrenceFields {
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  dueDate: string | null;
  createdAt?: string | null;
  biweeklyStart?: string | null;
  isHidden?: boolean;
  showInToday?: boolean;
}

/**
 * Determine whether a task applies to a specific date.
 *
 * Handles daily, weekly, biweekly, and monthly recurrence patterns.
 * If `checkVisibility` is true (default), tasks with `isHidden` or
 * `showInToday === false` are excluded.
 */
export function taskAppliesToDate(
  task: TaskRecurrenceFields,
  date: Date,
  dateStr: string,
  dayOfWeek: string,
  checkVisibility = true,
): boolean {
  if (checkVisibility) {
    if (task.isHidden) return false;
    if (task.showInToday === false) return false;
  }

  // Never show a recurring task on a date before it was created
  if (task.isRecurring && task.createdAt) {
    const createdDateStr = (task.createdAt as string).split("T")[0];
    if (dateStr < createdDateStr) return false;
  }

  if (!task.isRecurring) return task.dueDate === dateStr;

  const rType = task.recurringType || "weekly";

  if (rType === "daily") return true;

  if (rType === "weekly") {
    if (!task.recurringDays) return false;
    try {
      return (JSON.parse(task.recurringDays) as string[]).includes(dayOfWeek);
    } catch {
      return false;
    }
  }

  if (rType === "biweekly") {
    if (!task.recurringDays) return false;
    try {
      const days = JSON.parse(task.recurringDays) as string[];
      if (!days.includes(dayOfWeek)) return false;
      const anchorDate = task.createdAt ? new Date(task.createdAt) : new Date(0);
      const anchorWeek = startOfWeekMonday(anchorDate);
      const targetWeek = startOfWeekMonday(date);
      const weeksDiff = Math.round(
        (targetWeek.getTime() - anchorWeek.getTime()) / (7 * 86400000),
      );
      const isEvenInterval = weeksDiff % 2 === 0;
      return task.biweeklyStart === "next" ? !isEvenInterval : isEvenInterval;
    } catch {
      return false;
    }
  }

  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try {
      return (JSON.parse(task.recurringDays) as number[]).includes(date.getDate());
    } catch {
      return false;
    }
  }

  return false;
}
