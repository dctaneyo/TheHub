import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, getEffectiveLocationIdFromBody } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { broadcastTaskUpdate, broadcastTaskUncompleted, broadcastLeaderboardUpdate, broadcastHealthChanged } from "@/lib/socket-emit";
import { refreshTaskTimers } from "@/lib/task-notification-scheduler";
import { validate, uncompleteTaskSchema } from "@/lib/validations";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "location" && session.userType !== "arl") {
      return ApiErrors.forbidden();
    }

    const body = await req.json();
    const parsed = validate(uncompleteTaskSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { taskId, completedDate: requestedDate, localDate } = parsed.data;

    const effectiveLocationId = getEffectiveLocationIdFromBody(session, body);
    const targetDate = requestedDate || localDate || new Date().toISOString().split("T")[0];

    const completion = db
      .select()
      .from(schema.taskCompletions)
      .where(
        and(
          eq(schema.taskCompletions.taskId, taskId),
          eq(schema.taskCompletions.locationId, effectiveLocationId),
          eq(schema.taskCompletions.completedDate, targetDate)
        )
      )
      .get();

    if (!completion) {
      return ApiErrors.notFound("No completion found for this date");
    }

    db.delete(schema.taskCompletions)
      .where(eq(schema.taskCompletions.id, completion.id))
      .run();

    broadcastTaskUpdate(effectiveLocationId, session.tenantId);
    broadcastTaskUncompleted(effectiveLocationId, taskId, session.tenantId);
    broadcastLeaderboardUpdate(effectiveLocationId, session.tenantId);
    refreshTaskTimers();

    // Compute health score and emit health:changed if delta >= 10
    try {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      // Get today's tasks for this location
      const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, session.tenantId)).all()
        .filter(t => !t.locationId || t.locationId === effectiveLocationId);
      const remainingCompletions = db.select().from(schema.taskCompletions).where(
        and(eq(schema.taskCompletions.locationId, effectiveLocationId), eq(schema.taskCompletions.completedDate, targetDate))
      ).all();
      const completedTaskIds = new Set(remainingCompletions.map(c => c.taskId));
      let overdueCount = 0;
      let dueSoonCount = 0;
      for (const t of allTasks) {
        if (completedTaskIds.has(t.id)) continue;
        if (t.dueTime < hhmm) overdueCount++;
        else if (t.dueTime >= hhmm && t.dueTime <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes() + 30).padStart(2, "0")}`) dueSoonCount++;
      }
      const afterScore = Math.max(0, Math.min(100, 100 - (overdueCount * 15) - (dueSoonCount * 5)));
      // Before uncompleting, the task was completed so overdue count was one less
      const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
      const beforeOverdue = task && task.dueTime < hhmm ? overdueCount - 1 : overdueCount;
      const beforeScore = Math.max(0, Math.min(100, 100 - (Math.max(0, beforeOverdue) * 15) - (dueSoonCount * 5)));
      const delta = Math.abs(afterScore - beforeScore);
      if (delta >= 10) {
        broadcastHealthChanged(effectiveLocationId, afterScore, overdueCount, session.tenantId);
      }
    } catch (healthErr) {
      // Non-critical — don't fail the request
      console.error("Health score computation error:", healthErr);
    }

    return apiSuccess({ success: true, pointsRevoked: completion.pointsEarned });
  } catch (error) {
    console.error("Uncomplete task error:", error);
    return ApiErrors.internal();
  }
}
