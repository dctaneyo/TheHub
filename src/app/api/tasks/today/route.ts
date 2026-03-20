import { NextResponse } from "next/server";
import { getAuthSession, unauthorized, getEffectiveLocationId } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { taskAppliesToDate } from "@/lib/task-utils";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    // Use client-supplied local date/time to avoid UTC vs local timezone mismatch.
    // The kiosk sends its local values; server UTC would give wrong overdue results.
    const { searchParams } = new URL(req.url);
    const localDate = searchParams.get("localDate"); // YYYY-MM-DD
    const localTime = searchParams.get("localTime"); // HH:mm
    const localDay = searchParams.get("localDay");   // sun|mon|...

    // Build today's date from the client-supplied localDate to avoid UTC vs local mismatch.
    // Appending T12:00:00 avoids DST edge cases when constructing a Date from a date-only string.
    const todayStr = localDate || new Date().toISOString().split("T")[0];
    const today = new Date(`${todayStr}T12:00:00`);
    const dayOfWeek = localDay || ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][today.getDay()];

    // Get all tasks for this location (or all locations if locationId is null)
    // In mirror mode, an ARL can pass ?locationId=<targetId> to view a specific location's tasks
    const locationId = getEffectiveLocationId(session, searchParams);

    const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, session.tenantId)).all();

    // Filter tasks that apply today (exclude hidden and showInToday=false)
    const todayTasks = allTasks.filter((task) => {
      if (task.isHidden) return false;
      if (!task.showInToday) return false;
      if (locationId && task.locationId && task.locationId !== locationId) return false;
      return taskAppliesToDate(task, today, todayStr, dayOfWeek, false);
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

    // Get yesterday's missed tasks — derive from localDate so it's always the day before the client's today.
    const yesterday = new Date(`${todayStr}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
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
    
    // Helper to convert time string to minutes for proper comparison
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    
    const nowMinutes = timeToMinutes(now);

    const tasksWithStatus = todayTasks.map((task) => {
      const taskMinutes = timeToMinutes(task.dueTime);
      const isCompleted = completedTaskIds.has(task.id);
      const isOverdue = !isCompleted && taskMinutes < nowMinutes;
      const isDueSoon = !isCompleted && !isOverdue && taskMinutes >= nowMinutes && taskMinutes <= nowMinutes + 30;
      
      return {
        ...task,
        isCompleted,
        isOverdue,
        isDueSoon,
      };
    });

    return apiSuccess({
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
    return ApiErrors.internal();
  }
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

