import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/**
 * Shared task-applies-to-date logic — the same rules used wherever a task is
 * actually configured (recurring type/days, biweekly anchor, etc). Extracted
 * from grid-calendar.tsx so the /calendar route (and anywhere else that
 * needs "what's due on date X") can't drift from how the widget computes it,
 * which is what happened to the previous standalone /calendar page: it had
 * its own separate, never-reconciled copy of this logic.
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
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function taskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = DAY_KEYS[date.getDay()];
  if (task.createdAt) {
    const created = task.createdAt.split("T")[0];
    if (dateStr < created) return false;
  }
  if (!task.isRecurring) return task.dueDate === dateStr;
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") {
    try { return (JSON.parse(task.recurringDays!) as string[]).includes(dayKey); } catch { return false; }
  }
  if (rType === "biweekly") {
    try {
      const days = JSON.parse(task.recurringDays!) as string[];
      if (!days.includes(dayKey)) return false;
      const anchor = task.createdAt ? new Date(task.createdAt) : new Date(0);
      const anchorDay = anchor.getDay();
      const anchorMon = new Date(anchor);
      anchorMon.setDate(anchor.getDate() + (anchorDay === 0 ? -6 : 1 - anchorDay));
      anchorMon.setHours(0, 0, 0, 0);
      const targetDay = date.getDay();
      const targetMon = new Date(date);
      targetMon.setDate(date.getDate() + (targetDay === 0 ? -6 : 1 - targetDay));
      targetMon.setHours(0, 0, 0, 0);
      const weeksDiff = Math.round((targetMon.getTime() - anchorMon.getTime()) / (7 * 86400000));
      const isEven = weeksDiff % 2 === 0;
      return task.biweeklyStart === "next" ? !isEven : isEven;
    } catch { return false; }
  }
  if (rType === "monthly") {
    try { return (JSON.parse(task.recurringDays!) as number[]).includes(date.getDate()); } catch { return false; }
  }
  return false;
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
