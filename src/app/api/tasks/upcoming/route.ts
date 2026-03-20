import { NextResponse } from "next/server";
import { getAuthSession, unauthorized, getEffectiveLocationId } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { addDays, format } from "date-fns";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { taskAppliesToDate } from "@/lib/task-utils";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const locationId = getEffectiveLocationId(session, searchParams);
    const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, session.tenantId)).all();
    const allCompletions = locationId
      ? db.select().from(schema.taskCompletions).where(eq(schema.taskCompletions.locationId, locationId)).all()
      : [];
    const localDate = searchParams.get("localDate");
    const today = localDate ? new Date(`${localDate}T12:00:00`) : new Date();

    const upcoming: Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string; allowEarlyComplete: boolean; isCompleted: boolean }>> = {};

    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];

      const dayTasks = allTasks.filter((task) => {
        if (task.isHidden) return false;
        if (!task.showIn7Day) return false;
        if (locationId && task.locationId && task.locationId !== locationId) return false;
        return taskAppliesToDate(task, date, dateStr, dayOfWeek, false);
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
            allowEarlyComplete: t.allowEarlyComplete,
            isCompleted: allCompletions.some((c) => c.taskId === t.id && c.completedDate === dateStr),
          }));
      }
    }

    return apiSuccess({ upcoming });
  } catch (error) {
    console.error("Upcoming tasks error:", error);
    return ApiErrors.internal();
  }
}

