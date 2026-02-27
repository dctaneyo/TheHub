import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Locations
    const allLocations = db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).all();
    const allSessions = db.select().from(schema.sessions).all();
    const onlineLocations = allLocations.filter(loc => {
      return allSessions.some(s => s.userId === loc.id && s.isOnline);
    });

    // Tasks
    const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.isHidden, false)).all();
    const todayCompletions = db.select().from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.completedDate, todayDate)).all();

    // Count overdue tasks across all locations
    let overdueCount = 0;
    let totalDueToday = 0;
    for (const loc of allLocations) {
      const locTasks = allTasks.filter(t => !t.locationId || t.locationId === loc.id);
      for (const task of locTasks) {
        // Simple check: is this task due today and is its time past?
        const isDueToday = !task.dueDate || task.dueDate === todayDate || task.isRecurring;
        if (!isDueToday) continue;
        totalDueToday++;
        const isCompleted = todayCompletions.some(c => c.taskId === task.id && c.locationId === loc.id);
        if (!isCompleted && task.dueTime < nowTime) {
          overdueCount++;
        }
      }
    }

    const completedToday = todayCompletions.length;
    const completionRate = totalDueToday > 0 ? Math.round((completedToday / totalDueToday) * 100) : 0;

    // Points earned today
    const pointsToday = todayCompletions.reduce((sum, c) => sum + (c.pointsEarned || 0) + (c.bonusPoints || 0), 0);

    // Emergency alerts
    const activeEmergencies = db.select().from(schema.emergencyMessages)
      .where(eq(schema.emergencyMessages.isActive, true)).all();

    // Unread messages (across all conversations for this ARL)
    const conversations = db.select().from(schema.conversations).all();
    let unreadMessages = 0;
    // Simple approach: count messages created today that this ARL hasn't read
    // (For a more accurate count, we'd check message_reads)

    // Completion trend: last 7 days
    const trend: { date: string; completed: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayCompletions = db.select().from(schema.taskCompletions)
        .where(eq(schema.taskCompletions.completedDate, dateStr)).all();
      trend.push({
        date: dateStr,
        completed: dayCompletions.length,
        total: totalDueToday, // approximation
      });
    }

    // Top performing locations today
    const locationPerformance = allLocations.map(loc => {
      const locCompletions = todayCompletions.filter(c => c.locationId === loc.id);
      const locPoints = locCompletions.reduce((sum, c) => sum + (c.pointsEarned || 0) + (c.bonusPoints || 0), 0);
      return {
        id: loc.id,
        name: loc.name,
        storeNumber: loc.storeNumber,
        completedToday: locCompletions.length,
        pointsToday: locPoints,
        isOnline: onlineLocations.some(ol => ol.id === loc.id),
      };
    }).sort((a, b) => b.pointsToday - a.pointsToday);

    return NextResponse.json({
      locationsOnline: onlineLocations.length,
      locationsTotal: allLocations.length,
      overdueCount,
      completedToday,
      totalDueToday,
      completionRate,
      pointsToday,
      activeEmergencies: activeEmergencies.length,
      trend,
      locationPerformance,
    });
  } catch (error) {
    console.error("Overview analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
