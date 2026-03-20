import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, getEffectiveLocationIdFromBody } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { broadcastTaskUpdate, broadcastTaskUncompleted, broadcastLeaderboardUpdate } from "@/lib/socket-emit";
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

    return apiSuccess({ success: true, pointsRevoked: completion.pointsEarned });
  } catch (error) {
    console.error("Uncomplete task error:", error);
    return ApiErrors.internal();
  }
}
