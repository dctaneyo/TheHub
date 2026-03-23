import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastMoodUpdated } from "@/lib/socket-emit";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    if (session.userType !== "location") {
      return ApiErrors.forbidden("Only location users can submit mood check-ins");
    }

    const body = await req.json();
    const { moodScore } = body;

    if (
      typeof moodScore !== "number" ||
      !Number.isInteger(moodScore) ||
      moodScore < 1 ||
      moodScore > 5
    ) {
      return ApiErrors.badRequest("moodScore must be an integer between 1 and 5");
    }

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const id = uuid();

    db.insert(schema.moodCheckins).values({
      id,
      tenantId: session.tenantId,
      locationId: session.id,
      date,
      moodScore,
      createdAt: now.toISOString(),
    }).run();

    // Compute average mood for this location today for the socket event
    const agg = db
      .select({ avg: sql<number>`avg(${schema.moodCheckins.moodScore})` })
      .from(schema.moodCheckins)
      .where(
        and(
          eq(schema.moodCheckins.tenantId, session.tenantId),
          eq(schema.moodCheckins.locationId, session.id),
          eq(schema.moodCheckins.date, date)
        )
      )
      .get();

    const avgMoodScore = agg?.avg ? Math.round(agg.avg * 10) / 10 : moodScore;

    broadcastMoodUpdated(session.id, date, avgMoodScore, session.tenantId);

    return apiSuccess({ id }, 201);
  } catch (error) {
    console.error("POST /api/mood-checkins error:", error);
    return ApiErrors.internal();
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    if (session.userType !== "arl") {
      return ApiErrors.forbidden("Only ARL users can view mood check-in data");
    }

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const conditions = [eq(schema.moodCheckins.tenantId, session.tenantId)];

    if (locationId) {
      conditions.push(eq(schema.moodCheckins.locationId, locationId));
    }
    if (startDate) {
      conditions.push(gte(schema.moodCheckins.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.moodCheckins.date, endDate));
    }

    const rows = db
      .select({
        date: schema.moodCheckins.date,
        locationId: schema.moodCheckins.locationId,
        moodScore: sql<number>`avg(${schema.moodCheckins.moodScore})`,
        count: sql<number>`count(*)`,
      })
      .from(schema.moodCheckins)
      .where(and(...conditions))
      .groupBy(schema.moodCheckins.date, schema.moodCheckins.locationId)
      .orderBy(schema.moodCheckins.date)
      .all();

    const checkins = rows.map((r) => ({
      date: r.date,
      locationId: r.locationId,
      moodScore: Math.round(r.moodScore * 10) / 10,
      count: r.count,
    }));

    return apiSuccess({ checkins });
  } catch (error) {
    console.error("GET /api/mood-checkins error:", error);
    return ApiErrors.internal();
  }
}
