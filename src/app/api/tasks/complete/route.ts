import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, getEffectiveLocationIdFromBody } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastTaskCompleted, broadcastLeaderboardUpdate, broadcastHealthChanged } from "@/lib/socket-emit";
import { sendPushToAllARLs } from "@/lib/push";
import { createNotificationBulk } from "@/lib/notifications";
import { refreshTaskTimers } from "@/lib/task-notification-scheduler";
import { validate, completeTaskSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    // Allow locations directly, and ARLs in mirror/control mode
    if (session.userType !== "location" && session.userType !== "arl") {
      return ApiErrors.forbidden();
    }

    const body = await req.json();
    const parsed = validate(completeTaskSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { taskId, notes, completedDate: requestedDate, localDate } = parsed.data;

    // In mirror mode, ARL acts on behalf of a location
    const effectiveLocationId = getEffectiveLocationIdFromBody(session, body);

    const task = db.select().from(schema.tasks).where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.tenantId, session.tenantId))).get();
    if (!task) {
      return ApiErrors.notFound("Task");
    }

    // Prefer client-supplied localDate (avoids UTC vs local timezone mismatch on Railway).
    // Fall back to requestedDate (early-complete from calendar), then server UTC.
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = requestedDate || localDate || todayStr;

    // If completing for a future date, check allowEarlyComplete
    if (targetDate > todayStr && !task.allowEarlyComplete) {
      return ApiErrors.forbidden("This task cannot be completed early");
    }

    // Early bird bonus: +25% when completing ahead of due date
    const isEarly = targetDate > todayStr;
    const bonusPoints = isEarly ? Math.round(task.points * 0.25) : 0;

    const completion = {
      id: uuid(),
      taskId,
      locationId: effectiveLocationId,
      completedAt: new Date().toISOString(),
      completedDate: targetDate,
      notes: notes || null,
      pointsEarned: task.points,
      bonusPoints,
    };

    db.insert(schema.taskCompletions).values(completion).run();

    // Broadcast instant update via WebSocket
    // Use the effective location for broadcasts (target location in mirror mode)
    const broadcastLocationId = effectiveLocationId;
    const broadcastLocationName = session.userType === "arl" ? (body.mirrorLocationName as string || session.name) : session.name;
    broadcastTaskCompleted(broadcastLocationId, taskId, task.title, task.points + bonusPoints, broadcastLocationName, session.tenantId);
    broadcastLeaderboardUpdate(broadcastLocationId, session.tenantId);

    // Push notification to all ARLs about the task completion
    const pointsTotal = task.points + bonusPoints;
    await sendPushToAllARLs({
      title: `${session.name} completed a task! ✅`,
      body: `${task.title} · +${pointsTotal} pts${bonusPoints > 0 ? ` (incl. +${bonusPoints} early bonus)` : ""}`,
      url: `/arl`,
    });

    // Create in-app notifications for all ARLs
    const allArls = db.select().from(schema.arls).where(and(eq(schema.arls.isActive, true), eq(schema.arls.tenantId, session.tenantId))).all();
    await createNotificationBulk(
      allArls.map(arl => arl.id),
      {
        userType: "arl",
        type: "task_completed",
        title: `${session.name} completed a task`,
        message: `${task.title} · +${pointsTotal} pts${bonusPoints > 0 ? ` (incl. +${bonusPoints} early bonus)` : ""}`,
        actionUrl: "/arl?view=tasks",
        actionLabel: "View Tasks",
        priority: "normal",
        metadata: {
          taskId,
          locationId: effectiveLocationId,
          locationName: broadcastLocationName,
          points: pointsTotal,
        },
      }
    );

    refreshTaskTimers();

    // Compute health score and emit health:changed if delta >= 10
    try {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      // Get today's tasks for this location
      const allTasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, session.tenantId)).all()
        .filter(t => !t.locationId || t.locationId === effectiveLocationId);
      const completions = db.select().from(schema.taskCompletions).where(
        and(eq(schema.taskCompletions.locationId, effectiveLocationId), eq(schema.taskCompletions.completedDate, targetDate))
      ).all();
      const completedTaskIds = new Set(completions.map(c => c.taskId));
      let overdueCount = 0;
      let dueSoonCount = 0;
      for (const t of allTasks) {
        if (completedTaskIds.has(t.id)) continue;
        if (t.dueTime < hhmm) overdueCount++;
        else if (t.dueTime >= hhmm && t.dueTime <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes() + 30).padStart(2, "0")}`) dueSoonCount++;
      }
      const afterScore = Math.max(0, Math.min(100, 100 - (overdueCount * 15) - (dueSoonCount * 5)));
      // Before completing this task, it would have been overdue (or not), so estimate before score
      const beforeOverdue = overdueCount + (task.dueTime < hhmm ? 1 : 0);
      const beforeScore = Math.max(0, Math.min(100, 100 - (beforeOverdue * 15) - (dueSoonCount * 5)));
      const delta = Math.abs(afterScore - beforeScore);
      if (delta >= 10) {
        broadcastHealthChanged(effectiveLocationId, afterScore, overdueCount, session.tenantId);
      }
    } catch (healthErr) {
      // Non-critical — don't fail the request
      console.error("Health score computation error:", healthErr);
    }

    return apiSuccess({
      pointsEarned: task.points,
      bonusPoints,
      totalPoints: task.points + bonusPoints,
      isEarly,
      completion,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    return ApiErrors.internal();
  }
}
