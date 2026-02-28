import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { addDays, format } from "date-fns";

// Returns the Monday of the week containing `d`
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function taskAppliesToDate(
  task: { isRecurring: boolean; recurringType: string | null; recurringDays: string | null; dueDate: string | null; createdAt?: string; biweeklyStart?: string | null; isHidden: boolean; showInToday: boolean },
  date: Date,
  dateStr: string,
  dayOfWeek: string
): boolean {
  if (task.isHidden) return false;
  if (!task.showInToday) return false;
  if (task.isRecurring && task.createdAt) {
    const createdDateStr = (task.createdAt as string).split("T")[0];
    if (dateStr < createdDateStr) return false;
  }
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
      return task.biweeklyStart === "next" ? !isEvenInterval : isEvenInterval;
    } catch { return false; }
  }
  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as number[]).includes(date.getDate()); } catch { return false; }
  }
  return false;
}

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const locations = db.select().from(schema.locations).where(and(eq(schema.locations.isActive, true), eq(schema.locations.tenantId, session.tenantId))).all();
    const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, session.tenantId)).all();
    const allCompletions = db.select().from(schema.taskCompletions).all();

    const { searchParams } = new URL(req.url);
    const localDate = searchParams.get("localDate");
    const today = localDate ? new Date(`${localDate}T12:00:00`) : new Date();
    const weekStart = startOfWeekMonday(today);
    const weekEnd = addDays(weekStart, 6); // Sunday

    // Build date range strings for this week (Mon-Sun)
    const weekDates: { date: Date; dateStr: string; dayOfWeek: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      weekDates.push({
        date: d,
        dateStr: format(d, "yyyy-MM-dd"),
        dayOfWeek: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()],
      });
    }

    const weekDateStrings = new Set(weekDates.map((wd) => wd.dateStr));

    const leaderboard = locations.map((loc) => {
      // Count total expected tasks for this location this week
      let totalTasks = 0;
      let completedTasks = 0;
      let basePoints = 0;
      let bonusPoints = 0;

      for (const wd of weekDates) {
        const dayTasks = allTasks.filter((task) => {
          if (task.locationId && task.locationId !== loc.id) return false;
          if (!task.locationId) { /* applies to all */ }
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
      };
    });

    // Sort by completion % desc, then by total points desc
    leaderboard.sort((a, b) => {
      if (b.completionPct !== a.completionPct) return b.completionPct - a.completionPct;
      return b.totalPoints - a.totalPoints;
    });

    // Assign ranks (tied locations share rank)
    let rank = 1;
    for (let i = 0; i < leaderboard.length; i++) {
      if (i > 0 && (leaderboard[i].completionPct !== leaderboard[i - 1].completionPct || leaderboard[i].totalPoints !== leaderboard[i - 1].totalPoints)) {
        rank = i + 1;
      }
      (leaderboard[i] as any).rank = rank;
    }

    return NextResponse.json({
      leaderboard: leaderboard.map((l) => ({ ...l, rank: (l as any).rank })),
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
