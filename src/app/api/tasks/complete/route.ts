import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, getEffectiveLocationIdFromBody } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastTaskCompleted } from "@/lib/socket-emit";
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

    // Past dates are locked — a recurring task's history can't be rewritten
    // after the fact (a missed day stays missed).
    if (targetDate < todayStr) {
      return ApiErrors.forbidden("This task can no longer be completed — that day has passed");
    }

    // If completing for a future date, check allowEarlyComplete
    if (targetDate > todayStr && !task.allowEarlyComplete) {
      return ApiErrors.forbidden("This task cannot be completed early");
    }

    const isEarly = targetDate > todayStr;

    const completion = {
      id: uuid(),
      taskId,
      locationId: effectiveLocationId,
      completedAt: new Date().toISOString(),
      completedDate: targetDate,
      notes: notes || null,
      pointsEarned: 0,
      bonusPoints: 0,
    };

    db.insert(schema.taskCompletions).values(completion).run();

    // Broadcast instant update via WebSocket
    // Use the effective location for broadcasts (target location in mirror mode)
    const broadcastLocationId = effectiveLocationId;
    const broadcastLocationName = session.userType === "arl" ? (body.mirrorLocationName as string || session.name) : session.name;
    broadcastTaskCompleted(broadcastLocationId, taskId, task.title, 0, broadcastLocationName, session.tenantId);

    // Push notification to all ARLs about the task completion
    await sendPushToAllARLs({
      title: `${session.name} completed a task! ✅`,
      body: task.title,
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
        message: task.title,
        actionUrl: "/arl?view=tasks",
        actionLabel: "View Tasks",
        priority: "normal",
        metadata: {
          taskId,
          locationId: effectiveLocationId,
          locationName: broadcastLocationName,
        },
      }
    );

    refreshTaskTimers();

    return apiSuccess({
      isEarly,
      completion,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    return ApiErrors.internal();
  }
}
