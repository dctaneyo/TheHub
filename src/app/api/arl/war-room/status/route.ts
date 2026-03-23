import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    if (session.userType !== "arl") return ApiErrors.forbidden("ARL access required");

    // Get ARL's assigned locations
    const arl = db
      .select({ assignedLocationIds: schema.arls.assignedLocationIds })
      .from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId)))
      .get();

    const assignedIds: string[] | null = arl?.assignedLocationIds
      ? JSON.parse(arl.assignedLocationIds)
      : null;

    // Get all active locations for this tenant
    let locations = db
      .select({
        id: schema.locations.id,
        name: schema.locations.name,
        storeNumber: schema.locations.storeNumber,
        latitude: schema.locations.latitude,
        longitude: schema.locations.longitude,
      })
      .from(schema.locations)
      .where(
        and(
          eq(schema.locations.tenantId, session.tenantId),
          eq(schema.locations.isActive, true)
        )
      )
      .all();

    // Filter to assigned locations if set
    if (assignedIds) {
      const idSet = new Set(assignedIds);
      locations = locations.filter((l) => idSet.has(l.id));
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const nowHHMM = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

    // Get all non-hidden tasks for this tenant
    const allTasks = db
      .select({ id: schema.tasks.id, dueTime: schema.tasks.dueTime, locationId: schema.tasks.locationId })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.tenantId, session.tenantId),
          eq(schema.tasks.isHidden, false)
        )
      )
      .all();

    // Get all completions for today
    const completions = db
      .select({ taskId: schema.taskCompletions.taskId, locationId: schema.taskCompletions.locationId })
      .from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.completedDate, dateStr))
      .all();

    const completionSet = new Set(completions.map((c) => `${c.locationId}:${c.taskId}`));

    // Get mood check-ins for today
    const moods = db
      .select({
        locationId: schema.moodCheckins.locationId,
        avg: sql<number>`avg(${schema.moodCheckins.moodScore})`,
      })
      .from(schema.moodCheckins)
      .where(eq(schema.moodCheckins.date, dateStr))
      .groupBy(schema.moodCheckins.locationId)
      .all();

    const moodMap = new Map(moods.map((m) => [m.locationId, Math.round((m.avg ?? 0) * 10) / 10]));

    // Get online status from sessions
    const onlineSessions = db
      .select({ userId: schema.sessions.userId })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userType, "location"),
          eq(schema.sessions.isOnline, true)
        )
      )
      .all();

    const onlineSet = new Set(onlineSessions.map((s) => s.userId));

    // Build location data
    const result = locations.map((loc) => {
      // Tasks relevant to this location (locationId null = all locations, or matching)
      const locTasks = allTasks.filter(
        (t) => !t.locationId || t.locationId === loc.id
      );
      const totalTodayTasks = locTasks.length;
      const completedToday = locTasks.filter(
        (t) => completionSet.has(`${loc.id}:${t.id}`)
      ).length;

      // Overdue = past due time and not completed
      const overdueCount = locTasks.filter(
        (t) => t.dueTime < nowHHMM && !completionSet.has(`${loc.id}:${t.id}`)
      ).length;

      // Due soon = within 30 min and not completed
      const dueSoonTime = new Date(today.getTime() + 30 * 60 * 1000);
      const dueSoonHHMM = `${String(dueSoonTime.getHours()).padStart(2, "0")}:${String(dueSoonTime.getMinutes()).padStart(2, "0")}`;
      const dueSoonCount = locTasks.filter(
        (t) =>
          t.dueTime >= nowHHMM &&
          t.dueTime <= dueSoonHHMM &&
          !completionSet.has(`${loc.id}:${t.id}`)
      ).length;

      const healthScore = Math.max(0, Math.min(100, 100 - overdueCount * 15 - dueSoonCount * 5));
      const taskCompletionPct = totalTodayTasks > 0 ? Math.round((completedToday / totalTodayTasks) * 100) : 100;

      return {
        id: loc.id,
        name: loc.name,
        storeNumber: loc.storeNumber,
        healthScore,
        taskCompletionPct,
        moodScore: moodMap.get(loc.id) ?? null,
        isOnline: onlineSet.has(loc.id),
        latitude: loc.latitude,
        longitude: loc.longitude,
        alertCount: overdueCount,
      };
    });

    return apiSuccess({ locations: result });
  } catch (error) {
    console.error("GET /api/arl/war-room/status error:", error);
    return ApiErrors.internal();
  }
}
