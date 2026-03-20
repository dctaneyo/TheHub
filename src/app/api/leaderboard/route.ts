import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { addDays, format } from "date-fns";
import { cacheGetOrSet, cacheInvalidatePrefix } from "@/lib/cache";
import { startOfWeekMonday, taskAppliesToDate } from "@/lib/task-utils";

/**
 * Invalidate cached leaderboard data (call after task completions).
 */
export function invalidateLeaderboardCache(tenantId?: string) {
  if (tenantId) {
    cacheInvalidatePrefix(`leaderboard:${tenantId}`);
  } else {
    cacheInvalidatePrefix("leaderboard:");
  }
}

function computeLeaderboard(tenantId: string, localDate: string | null) {
  const locations = db.select().from(schema.locations).where(and(eq(schema.locations.isActive, true), eq(schema.locations.tenantId, tenantId))).all();
  const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, tenantId)).all();
  const allCompletions = db.select().from(schema.taskCompletions).all();

  const today = localDate ? new Date(`${localDate}T12:00:00`) : new Date();
  const weekStart = startOfWeekMonday(today);
  const weekEnd = addDays(weekStart, 6);

  const weekDates: { date: Date; dateStr: string; dayOfWeek: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    weekDates.push({
      date: d,
      dateStr: format(d, "yyyy-MM-dd"),
      dayOfWeek: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()],
    });
  }

  const leaderboard = locations.map((loc) => {
    let totalTasks = 0;
    let completedTasks = 0;
    let basePoints = 0;
    let bonusPoints = 0;

    for (const wd of weekDates) {
      const dayTasks = allTasks.filter((task) => {
        if (task.locationId && task.locationId !== loc.id) return false;
        return taskAppliesToDate(task as any, wd.date, wd.dateStr, wd.dayOfWeek);
      });
      totalTasks += dayTasks.length;

      for (const task of dayTasks) {
        const completion = allCompletions.find(
          (c) => c.taskId === task.id && c.locationId === loc.id && c.completedDate === wd.dateStr
        );
        if (completion) {
          completedTasks++;
          basePoints += completion.pointsEarned;
          bonusPoints += completion.bonusPoints ?? 0;
        }
      }
    }

    const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      locationId: loc.id,
      name: loc.name,
      storeNumber: loc.storeNumber,
      totalTasks,
      completedTasks,
      completionPct,
      basePoints,
      bonusPoints,
      totalPoints: basePoints + bonusPoints,
      rank: 0,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.completionPct !== a.completionPct) return b.completionPct - a.completionPct;
    return b.totalPoints - a.totalPoints;
  });

  let rank = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    if (i > 0 && (leaderboard[i].completionPct !== leaderboard[i - 1].completionPct || leaderboard[i].totalPoints !== leaderboard[i - 1].totalPoints)) {
      rank = i + 1;
    }
    leaderboard[i].rank = rank;
  }

  return {
    leaderboard,
    weekStart: format(weekStart, "yyyy-MM-dd"),
    weekEnd: format(weekEnd, "yyyy-MM-dd"),
  };
}

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = new URL(req.url);
    const localDate = searchParams.get("localDate");

    // Cache key includes tenant + date so each tenant/day gets its own cache
    const dateKey = localDate || format(new Date(), "yyyy-MM-dd");
    const cacheKey = `leaderboard:${session.tenantId}:${dateKey}`;

    const result = await cacheGetOrSet(cacheKey, 60, () =>
      computeLeaderboard(session.tenantId, localDate)
    );

    return apiSuccess(result);
  } catch (error) {
    console.error("Leaderboard error:", error);
    return ApiErrors.internal();
  }
}
