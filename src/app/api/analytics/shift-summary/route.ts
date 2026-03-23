import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

function getShiftPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getShiftHourRange(period: "morning" | "afternoon" | "evening"): [number, number] {
  switch (period) {
    case "morning": return [0, 11];
    case "afternoon": return [12, 16];
    case "evening": return [17, 23];
  }
}

interface ShiftSummary {
  completionDelta: number | null;
  fastestTask: { title: string; minutesEarly: number } | null;
  earlyCount: number;
  totalTasks: number;
  totalPoints: number;
  snippets: string[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const date = searchParams.get("date");
    const shiftPeriod = searchParams.get("shiftPeriod") as "morning" | "afternoon" | "evening" | null;

    // Determine effective values
    let effectiveLocationId: string;
    if (session.userType === "location") {
      effectiveLocationId = session.id;
    } else if (locationId) {
      effectiveLocationId = locationId;
    } else {
      return ApiErrors.badRequest("locationId is required for ARL users");
    }

    const now = new Date();
    const effectiveDate = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const effectivePeriod = shiftPeriod || getShiftPeriod(now.getHours());
    const [startHour, endHour] = getShiftHourRange(effectivePeriod);

    // Compute yesterday's date
    const dateObj = new Date(effectiveDate + "T00:00:00");
    dateObj.setDate(dateObj.getDate() - 1);
    const yesterdayDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

    // Get today's completions for this location + shift period
    // We filter by completedAt hour to match the shift period
    const todayCompletions = db
      .select({
        id: schema.taskCompletions.id,
        taskId: schema.taskCompletions.taskId,
        completedAt: schema.taskCompletions.completedAt,
        pointsEarned: schema.taskCompletions.pointsEarned,
        bonusPoints: schema.taskCompletions.bonusPoints,
      })
      .from(schema.taskCompletions)
      .where(
        and(
          eq(schema.taskCompletions.locationId, effectiveLocationId),
          eq(schema.taskCompletions.completedDate, effectiveDate)
        )
      )
      .all()
      .filter((c) => {
        const hour = new Date(c.completedAt).getHours();
        return hour >= startHour && hour <= endHour;
      });

    // Get yesterday's completions for comparison
    const yesterdayCompletions = db
      .select({
        id: schema.taskCompletions.id,
        completedAt: schema.taskCompletions.completedAt,
      })
      .from(schema.taskCompletions)
      .where(
        and(
          eq(schema.taskCompletions.locationId, effectiveLocationId),
          eq(schema.taskCompletions.completedDate, yesterdayDate)
        )
      )
      .all()
      .filter((c) => {
        const hour = new Date(c.completedAt).getHours();
        return hour >= startHour && hour <= endHour;
      });

    // Compute completionDelta
    const todayCount = todayCompletions.length;
    const yesterdayCount = yesterdayCompletions.length;
    let completionDelta: number | null = null;
    if (yesterdayCount > 0) {
      completionDelta = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
    }

    // Get task details for today's completions to compute fastest task and early completions
    const taskIds = [...new Set(todayCompletions.map((c) => c.taskId))];
    const tasksMap = new Map<string, { title: string; dueTime: string }>();
    if (taskIds.length > 0) {
      const tasks = db
        .select({
          id: schema.tasks.id,
          title: schema.tasks.title,
          dueTime: schema.tasks.dueTime,
        })
        .from(schema.tasks)
        .where(
          sql`${schema.tasks.id} IN (${sql.join(taskIds.map((id) => sql`${id}`), sql`, `)})`
        )
        .all();
      tasks.forEach((t) => tasksMap.set(t.id, { title: t.title, dueTime: t.dueTime }));
    }

    // Compute fastest task (smallest gap between completedAt time and dueTime)
    // and early completions (completedAt time < dueTime)
    let fastestTask: { title: string; minutesEarly: number } | null = null;
    let earlyCount = 0;
    let bestMinutesEarly = -Infinity;

    for (const completion of todayCompletions) {
      const task = tasksMap.get(completion.taskId);
      if (!task || !task.dueTime) continue;

      const completedDate = new Date(completion.completedAt);
      const completedMinutes = completedDate.getHours() * 60 + completedDate.getMinutes();

      const [dueH, dueM] = task.dueTime.split(":").map(Number);
      const dueMinutes = dueH * 60 + dueM;

      const minutesEarly = dueMinutes - completedMinutes;

      if (minutesEarly > 0) {
        earlyCount++;
      }

      if (minutesEarly > bestMinutesEarly) {
        bestMinutesEarly = minutesEarly;
        fastestTask = { title: task.title, minutesEarly };
      }
    }

    // Total points
    const totalPoints = todayCompletions.reduce(
      (sum, c) => sum + (c.pointsEarned ?? 0) + (c.bonusPoints ?? 0),
      0
    );

    // Generate encouraging snippets
    const snippets: string[] = [];

    if (completionDelta !== null) {
      if (completionDelta > 0) {
        snippets.push(`You completed ${completionDelta}% more tasks than yesterday's ${effectivePeriod} shift!`);
      } else if (completionDelta === 0) {
        snippets.push(`Same pace as yesterday's ${effectivePeriod} shift — steady work!`);
      } else {
        snippets.push(`${Math.abs(completionDelta)}% fewer tasks than yesterday — tomorrow's a new day!`);
      }
    } else if (todayCount > 0) {
      snippets.push(`${todayCount} task${todayCount !== 1 ? "s" : ""} completed this ${effectivePeriod} shift!`);
    }

    if (fastestTask && fastestTask.minutesEarly > 0) {
      snippets.push(`Fastest task: '${fastestTask.title}' done ${fastestTask.minutesEarly} minutes early 🏎️`);
    }

    if (earlyCount > 0 && todayCount > 0) {
      snippets.push(`${earlyCount} out of ${todayCount} tasks completed before their due time — great hustle!`);
    }

    if (totalPoints > 0) {
      snippets.push(`Total points earned: ${totalPoints} pts 🔥`);
    }

    const summary: ShiftSummary = {
      completionDelta,
      fastestTask: fastestTask && fastestTask.minutesEarly > 0 ? fastestTask : null,
      earlyCount,
      totalTasks: todayCount,
      totalPoints,
      snippets,
    };

    return apiSuccess({ summary });
  } catch (error) {
    console.error("GET /api/analytics/shift-summary error:", error);
    return ApiErrors.internal();
  }
}
