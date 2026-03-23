import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastShiftHandoff } from "@/lib/socket-emit";

function getShiftPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    if (session.userType !== "location") {
      return ApiErrors.forbidden("Only location users can create shift handoffs");
    }

    const now = new Date();
    const shiftDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const shiftPeriod = getShiftPeriod(now.getHours());

    // Check for duplicate handoff
    const existing = db
      .select({ id: schema.shiftHandoffs.id })
      .from(schema.shiftHandoffs)
      .where(
        and(
          eq(schema.shiftHandoffs.locationId, session.id),
          eq(schema.shiftHandoffs.shiftDate, shiftDate),
          eq(schema.shiftHandoffs.shiftPeriod, shiftPeriod)
        )
      )
      .get();

    if (existing) {
      return apiError("DUPLICATE", "A handoff already exists for this shift period", 409);
    }

    // Compute task counts from taskCompletions for today + this location
    const completedRows = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.taskCompletions)
      .where(
        and(
          eq(schema.taskCompletions.locationId, session.id),
          eq(schema.taskCompletions.completedDate, shiftDate)
        )
      )
      .get();
    const completedTaskCount = completedRows?.count ?? 0;

    // Get total tasks assigned to this location (or all locations)
    const allTasks = db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.tenantId, session.tenantId),
          eq(schema.tasks.isHidden, false)
        )
      )
      .all()
      .filter((t) => {
        // Filter tasks relevant to this location
        return true; // All non-hidden tasks for the tenant
      });

    // Get completed task IDs for today
    const completedTaskIds = db
      .select({ taskId: schema.taskCompletions.taskId })
      .from(schema.taskCompletions)
      .where(
        and(
          eq(schema.taskCompletions.locationId, session.id),
          eq(schema.taskCompletions.completedDate, shiftDate)
        )
      )
      .all()
      .map((r) => r.taskId);

    const completedSet = new Set(completedTaskIds);
    const remainingTaskIds = allTasks
      .filter((t) => !completedSet.has(t.id))
      .map((t) => t.id);
    const remainingTaskCount = remainingTaskIds.length;

    // Get mood score average for today
    const moodAgg = db
      .select({ avg: sql<number>`avg(${schema.moodCheckins.moodScore})` })
      .from(schema.moodCheckins)
      .where(
        and(
          eq(schema.moodCheckins.locationId, session.id),
          eq(schema.moodCheckins.date, shiftDate)
        )
      )
      .get();
    const moodScoreAvg = moodAgg?.avg ? Math.round(moodAgg.avg * 10) / 10 : null;

    const id = uuid();
    const handedOffAt = now.toISOString();

    db.insert(schema.shiftHandoffs).values({
      id,
      tenantId: session.tenantId,
      locationId: session.id,
      shiftDate,
      shiftPeriod,
      completedTaskCount,
      remainingTaskCount,
      remainingTaskIds: JSON.stringify(remainingTaskIds),
      arlMessages: null,
      moodScoreAvg,
      handedOffAt,
      createdAt: now.toISOString(),
    }).run();

    // Get location name for socket event
    const location = db
      .select({ name: schema.locations.name })
      .from(schema.locations)
      .where(eq(schema.locations.id, session.id))
      .get();

    broadcastShiftHandoff(
      session.id,
      location?.name ?? "Unknown",
      shiftPeriod,
      completedTaskCount,
      remainingTaskCount,
      session.tenantId
    );

    return apiSuccess({
      id,
      shiftDate,
      shiftPeriod,
      completedTaskCount,
      remainingTaskCount,
      moodScoreAvg,
      handedOffAt,
    }, 201);
  } catch (error) {
    console.error("POST /api/shift-handoffs error:", error);
    return ApiErrors.internal();
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const date = searchParams.get("date");

    const conditions = [eq(schema.shiftHandoffs.tenantId, session.tenantId)];

    // Location users can only see their own handoffs
    if (session.userType === "location") {
      conditions.push(eq(schema.shiftHandoffs.locationId, session.id));
    } else if (locationId) {
      conditions.push(eq(schema.shiftHandoffs.locationId, locationId));
    }

    if (date) {
      conditions.push(eq(schema.shiftHandoffs.shiftDate, date));
    }

    const handoffs = db
      .select()
      .from(schema.shiftHandoffs)
      .where(and(...conditions))
      .orderBy(schema.shiftHandoffs.createdAt)
      .all();

    return apiSuccess({ handoffs });
  } catch (error) {
    console.error("GET /api/shift-handoffs error:", error);
    return ApiErrors.internal();
  }
}
