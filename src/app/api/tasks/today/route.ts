import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Use client-supplied local date/time to avoid UTC vs local timezone mismatch.
    // The kiosk sends its local values; server UTC would give wrong overdue results.
    const { searchParams } = new URL(req.url);
    const localDate = searchParams.get("localDate"); // YYYY-MM-DD
    const localTime = searchParams.get("localTime"); // HH:mm
    const localDay = searchParams.get("localDay");   // sun|mon|...

    const today = new Date();
    const todayStr = localDate || today.toISOString().split("T")[0];
    const dayOfWeek = localDay || ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][today.getDay()];

    // Get all tasks for this location (or all locations if locationId is null)
    const locationId = session.userType === "location" ? session.id : null;

    const allTasks = db.select().from(schema.tasks).all();

    // Filter tasks that apply today (exclude hidden and showInToday=false)
    const todayTasks = allTasks.filter((task) => {
      if (task.isHidden) return false;
      if (!task.showInToday) return false;
      if (locationId && task.locationId && task.locationId !== locationId) return false;
      return taskAppliesToDate(task, today, todayStr, dayOfWeek);
    });

    // Get completions for today
    const completions = locationId
      ? db
          .select()
          .from(schema.taskCompletions)
          .where(
            and(
              eq(schema.taskCompletions.locationId, locationId),
              eq(schema.taskCompletions.completedDate, todayStr)
            )
          )
          .all()
      : [];

    const completedTaskIds = new Set(completions.map((c) => c.taskId));

    // Get yesterday's missed tasks
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const yesterdayDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][yesterday.getDay()];

    const yesterdayTasks = allTasks.filter((task) => {
      if (locationId && task.locationId && task.locationId !== locationId) return false;
      return taskAppliesToDate(task, yesterday, yesterdayStr, yesterdayDay);
    });

    const yesterdayCompletions = locationId
      ? db
          .select()
          .from(schema.taskCompletions)
          .where(
            and(
              eq(schema.taskCompletions.locationId, locationId),
              eq(schema.taskCompletions.completedDate, yesterdayStr)
            )
          )
          .all()
      : [];

    const yesterdayCompletedIds = new Set(yesterdayCompletions.map((c) => c.taskId));
    const missedTasks = yesterdayTasks.filter((t) => !yesterdayCompletedIds.has(t.id));

    // Sort today's tasks by due time
    todayTasks.sort((a, b) => a.dueTime.localeCompare(b.dueTime));

    const now = localTime || `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

    const tasksWithStatus = todayTasks.map((task) => ({
      ...task,
      isCompleted: completedTaskIds.has(task.id),
      isOverdue: !completedTaskIds.has(task.id) && task.dueTime < now,
      isDueSoon: !completedTaskIds.has(task.id) && !completedTaskIds.has(task.id) && task.dueTime >= now && task.dueTime <= addMinutes(now, 30),
    }));

    return NextResponse.json({
      tasks: tasksWithStatus,
      completedToday: completions.length,
      totalToday: todayTasks.length,
      missedYesterday: missedTasks.map((t) => ({
        ...t,
        isMissed: true,
      })),
      pointsToday: completions.reduce((sum, c) => sum + c.pointsEarned, 0),
    });
  } catch (error) {
    console.error("Tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

// Returns the Monday of the week containing `d` (week anchor for biweekly math)
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // days back to Monday
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
  // Never show a recurring task on a date before it was created
  if (task.isRecurring && task.createdAt) {
    const createdDateStr = task.createdAt.split("T")[0];
    if (dateStr < createdDateStr) return false;
  }
  if (!task.isRecurring) {
    return task.dueDate === dateStr;
  }
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
      // Anchor to the week the task was created (or epoch if missing)
      const anchorDate = task.createdAt ? new Date(task.createdAt) : new Date(0);
      const anchorWeek = startOfWeekMonday(anchorDate);
      const targetWeek = startOfWeekMonday(date);
      const weeksDiff = Math.round((targetWeek.getTime() - anchorWeek.getTime()) / (7 * 86400000));
      // biweeklyStart='this': fire on even intervals (0,2,4,...)
      // biweeklyStart='next': fire on odd intervals (1,3,5,...)
      const isEvenInterval = weeksDiff % 2 === 0;
      return (task as any).biweeklyStart === "next" ? !isEvenInterval : isEvenInterval;
    } catch { return false; }
  }
  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try {
      const days = JSON.parse(task.recurringDays) as number[];
      return days.includes(date.getDate());
    } catch { return false; }
  }
  return false;
}
