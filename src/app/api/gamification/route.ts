import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { format, subDays } from "date-fns";

// Returns the Monday of the week containing `d`
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
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

// Level thresholds
const LEVELS = [
  { level: 1, xpRequired: 0, title: "Rookie" },
  { level: 2, xpRequired: 100, title: "Team Player" },
  { level: 3, xpRequired: 300, title: "Go-Getter" },
  { level: 4, xpRequired: 600, title: "All-Star" },
  { level: 5, xpRequired: 1000, title: "Champion" },
  { level: 6, xpRequired: 1500, title: "Legend" },
  { level: 7, xpRequired: 2500, title: "Superstar" },
  { level: 8, xpRequired: 4000, title: "Icon" },
  { level: 9, xpRequired: 6000, title: "Master" },
  { level: 10, xpRequired: 10000, title: "Hall of Fame" },
];

function getLevel(totalXP: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXP >= l.xpRequired) current = l;
    else break;
  }
  const nextLevel = LEVELS.find((l) => l.xpRequired > totalXP) || null;
  const xpToNext = nextLevel ? nextLevel.xpRequired - totalXP : 0;
  const xpInLevel = nextLevel ? totalXP - current.xpRequired : 0;
  const xpLevelRange = nextLevel ? nextLevel.xpRequired - current.xpRequired : 1;
  const progress = nextLevel ? Math.round((xpInLevel / xpLevelRange) * 100) : 100;
  return { ...current, totalXP, xpToNext, progress, nextLevel };
}

// Badge definitions
interface BadgeResult {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const locationId = session.id;
    const allTasks = db.select().from(schema.tasks).all();
    const allCompletions = db
      .select()
      .from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.locationId, locationId))
      .all();

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // ── STREAK CALCULATION ──
    // Check each day going backwards. A day counts as "perfect" if all applicable tasks were completed.
    let streak = 0;
    // Start checking from yesterday (today might not be done yet)
    for (let i = 1; i <= 365; i++) {
      const checkDate = subDays(today, i);
      const checkStr = format(checkDate, "yyyy-MM-dd");
      const checkDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][checkDate.getDay()];

      const dayTasks = allTasks.filter((task) => {
        if (locationId && task.locationId && task.locationId !== locationId) return false;
        if (!task.locationId) { /* applies to all */ }
        return taskAppliesToDate(task as any, checkDate, checkStr, checkDay);
      });

      if (dayTasks.length === 0) continue; // Skip days with no tasks

      const dayCompletions = new Set(
        allCompletions.filter((c) => c.completedDate === checkStr).map((c) => c.taskId)
      );

      const allDone = dayTasks.every((t) => dayCompletions.has(t.id));
      if (allDone) {
        streak++;
      } else {
        break;
      }
    }

    // Streak milestones
    const streakMilestones = [
      { days: 3, name: "3-Day Streak", icon: "🔥" },
      { days: 7, name: "Week Warrior", icon: "⚡" },
      { days: 14, name: "Two-Week Titan", icon: "💪" },
      { days: 30, name: "Monthly Monster", icon: "🏆" },
    ];
    const currentMilestone = [...streakMilestones].reverse().find((m) => streak >= m.days) || null;
    const nextMilestone = streakMilestones.find((m) => streak < m.days) || null;

    // ── LEVEL / XP ──
    const totalXP = allCompletions.reduce((sum, c) => sum + c.pointsEarned + (c.bonusPoints ?? 0), 0);
    const level = getLevel(totalXP);

    // ── BADGES ──
    const badges: BadgeResult[] = [];

    // Early Bird: completed a task before 9am
    const earlyCompletions = allCompletions.filter((c) => {
      const hour = new Date(c.completedAt).getHours();
      return hour < 9;
    });
    badges.push({
      id: "early_bird",
      name: "Early Bird",
      description: "Complete a task before 9:00 AM",
      icon: "🌅",
      earned: earlyCompletions.length > 0,
      earnedDate: earlyCompletions[0]?.completedDate,
    });

    // Perfect Week: 7 consecutive days with 100% completion
    badges.push({
      id: "perfect_week",
      name: "Perfect Week",
      description: "Complete all tasks for 7 days straight",
      icon: "⭐",
      earned: streak >= 7,
    });

    // Speed Demon: complete all tasks before noon on any day
    let speedDemonEarned = false;
    const completionsByDate = new Map<string, typeof allCompletions>();
    for (const c of allCompletions) {
      const arr = completionsByDate.get(c.completedDate) || [];
      arr.push(c);
      completionsByDate.set(c.completedDate, arr);
    }
    for (const [dateStr, dayComps] of completionsByDate) {
      const d = new Date(dateStr + "T00:00:00");
      const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
      const dayTasks = allTasks.filter((task) => {
        if (locationId && task.locationId && task.locationId !== locationId) return false;
        return taskAppliesToDate(task as any, d, dateStr, dayKey);
      });
      if (dayTasks.length > 0) {
        const allCompletedBefore12 = dayTasks.every((t) => {
          const comp = dayComps.find((c) => c.taskId === t.id);
          if (!comp) return false;
          return new Date(comp.completedAt).getHours() < 12;
        });
        if (allCompletedBefore12) { speedDemonEarned = true; break; }
      }
    }
    badges.push({
      id: "speed_demon",
      name: "Speed Demon",
      description: "Complete all tasks before noon",
      icon: "⚡",
      earned: speedDemonEarned,
    });

    // First Steps: complete first ever task
    badges.push({
      id: "first_steps",
      name: "First Steps",
      description: "Complete your very first task",
      icon: "👣",
      earned: allCompletions.length > 0,
      earnedDate: allCompletions.length > 0 ? allCompletions[0]?.completedDate : undefined,
    });

    // Point Collector: earn 500+ total points
    badges.push({
      id: "point_collector",
      name: "Point Collector",
      description: "Earn 500 total points",
      icon: "💎",
      earned: totalXP >= 500,
    });

    // Bonus Hunter: earn early bird bonus points
    const hasBonusPoints = allCompletions.some((c) => (c.bonusPoints ?? 0) > 0);
    badges.push({
      id: "bonus_hunter",
      name: "Bonus Hunter",
      description: "Earn early bird bonus points",
      icon: "🎯",
      earned: hasBonusPoints,
    });

    // Streak Master: 30-day streak
    badges.push({
      id: "streak_master",
      name: "Streak Master",
      description: "Maintain a 30-day streak",
      icon: "🔥",
      earned: streak >= 30,
    });

    // Century Club: complete 100 tasks total
    badges.push({
      id: "century_club",
      name: "Century Club",
      description: "Complete 100 total tasks",
      icon: "💯",
      earned: allCompletions.length >= 100,
    });

    return NextResponse.json({
      streak: {
        current: streak,
        currentMilestone,
        nextMilestone,
        daysToNext: nextMilestone ? nextMilestone.days - streak : 0,
      },
      level,
      badges,
      stats: {
        totalTasksCompleted: allCompletions.length,
        totalXP,
        totalBonusPoints: allCompletions.reduce((sum, c) => sum + (c.bonusPoints ?? 0), 0),
      },
    });
  } catch (error) {
    console.error("Gamification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
