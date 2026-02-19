import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { addDays, format } from "date-fns";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const locationId = session.userType === "location" ? session.id : null;
    const allTasks = db.select().from(schema.tasks).all();
    const today = new Date();

    const upcoming: Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string }>> = {};

    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];

      const dayTasks = allTasks.filter((task) => {
        if (task.isHidden) return false;
        if (locationId && task.locationId && task.locationId !== locationId) return false;
        return taskAppliesToDate(task, date, dateStr, dayOfWeek);
      });

      if (dayTasks.length > 0) {
        upcoming[dateStr] = dayTasks
          .sort((a, b) => a.dueTime.localeCompare(b.dueTime))
          .map((t) => ({
            id: t.id,
            title: t.title,
            dueTime: t.dueTime,
            type: t.type,
            priority: t.priority,
          }));
      }
    }

    return NextResponse.json({ upcoming });
  } catch (error) {
    console.error("Upcoming tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function taskAppliesToDate(
  task: { isRecurring: boolean; recurringType: string | null; recurringDays: string | null; dueDate: string | null; createdAt?: string },
  date: Date,
  dateStr: string,
  dayOfWeek: string
): boolean {
  if (!task.isRecurring) return task.dueDate === dateStr;
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as string[]).includes(dayOfWeek); } catch { return false; }
  }
  if (rType === "biweekly") {
    if (!task.recurringDays) return false;
    try {
      const days = JSON.parse(task.recurringDays) as string[];
      if (!days.includes(dayOfWeek)) return false;
      const anchorDate = task.createdAt ? new Date(task.createdAt) : new Date(0);
      const anchorWeek = startOfWeekMonday(anchorDate);
      const targetWeek = startOfWeekMonday(date);
      const weeksDiff = Math.round((targetWeek.getTime() - anchorWeek.getTime()) / (7 * 86400000));
      const isEvenInterval = weeksDiff % 2 === 0;
      return (task as any).biweeklyStart === "next" ? !isEvenInterval : isEvenInterval;
    } catch { return false; }
  }
  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as number[]).includes(date.getDate()); } catch { return false; }
  }
  return false;
}
