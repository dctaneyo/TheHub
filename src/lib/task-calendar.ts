import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { taskAppliesToDate } from "@/lib/task-utils";

/**
 * Shared task-applies-to-date logic — the same rules used wherever a task is
 * actually configured (recurring type/days, biweekly anchor, etc). Extracted
 * from grid-calendar.tsx so the /calendar route (and anywhere else that
 * needs "what's due on date X") can't drift from how the widget computes it,
 * which is what happened to the previous standalone /calendar page: it had
 * its own separate, never-reconciled copy of this logic.
 *
 * The actual recurrence math now lives in task-utils.ts (taskAppliesToDate)
 * — this used to be its own independent reimplementation, which is exactly
 * the kind of drift the comment above warns about. taskApplies() is a thin
 * adapter so calendar call sites don't need to precompute dateStr/dayOfWeek.
 */

export interface CalTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueTime: string;
  isAllDay?: boolean;
  dueDate: string | null;
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  biweeklyStart?: string | null;
  locationId: string | null;
  createdAt?: string;
  showInCalendar?: boolean;
  allowEarlyComplete?: boolean;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function taskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = DAY_KEYS[date.getDay()];
  // false = no visibility gating — the calendar wants every task that's
  // due on this date, not just the ones flagged to show in dashboard views.
  return taskAppliesToDate(task, date, dateStr, dayKey, false);
}

export function buildWeeks(month: Date): Date[][] {
  const weeks: Date[][] = [];
  let day = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  while (day <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  }
  return weeks;
}

export function fmtTaskTime(t: string, allDay?: boolean): string {
  if (allDay) return "All Day";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  normal: "bg-blue-400",
  low: "bg-slate-400",
};
