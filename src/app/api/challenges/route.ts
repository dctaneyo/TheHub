import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET /api/challenges — list challenges for tenant, filter by status
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let conditions = [eq(schema.challenges.tenantId, session.tenantId)];
    if (status && ["active", "completed", "cancelled"].includes(status)) {
      conditions.push(eq(schema.challenges.status, status));
    }

    const challenges = db
      .select()
      .from(schema.challenges)
      .where(and(...conditions))
      .orderBy(desc(schema.challenges.createdAt))
      .all();

    // Get participant counts
    const result = challenges.map((c) => {
      const participants = db
        .select()
        .from(schema.challengeParticipants)
        .where(eq(schema.challengeParticipants.challengeId, c.id))
        .all();
      return { ...c, participantCount: participants.length };
    });

    return apiSuccess({ challenges: result });
  } catch (error) {
    console.error("GET /api/challenges error:", error);
    return ApiErrors.internal();
  }
}

// POST /api/challenges — create challenge (ARL only)
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return ApiErrors.forbidden("ARL access required");

    const body = await req.json();
    const { title, description, goalType, targetValue, startDate, endDate, locationIds } = body;

    if (!title || !goalType || !targetValue || !startDate || !endDate) {
      return ApiErrors.badRequest("Missing required fields");
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return ApiErrors.badRequest("End date must be after start date");
    }

    const validGoalTypes = ["consecutive_perfect_days", "total_points", "completion_rate", "fastest_completion"];
    if (!validGoalTypes.includes(goalType)) {
      return ApiErrors.badRequest("Invalid goal type");
    }

    const challengeId = uuid();
    const now = new Date().toISOString();

    // Create challenge
    db.insert(schema.challenges).values({
      id: challengeId,
      tenantId: session.tenantId,
      title,
      description: description || null,
      goalType,
      targetValue: Number(targetValue),
      startDate,
      endDate,
      status: "active",
      createdBy: session.id,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Determine participating locations
    let participatingIds: string[] = locationIds || [];
    if (!participatingIds.length) {
      // Default to all locations in tenant
      const allLocations = db
        .select({ id: schema.locations.id })
        .from(schema.locations)
        .where(eq(schema.locations.tenantId, session.tenantId))
        .all();
      participatingIds = allLocations.map((l) => l.id);
    }

    // Create participants
    for (const locId of participatingIds) {
      db.insert(schema.challengeParticipants).values({
        id: uuid(),
        challengeId,
        locationId: locId,
        joinedAt: now,
      }).run();
    }

    return apiSuccess({ challenge: { id: challengeId, title, status: "active" } }, 201);
  } catch (error) {
    console.error("POST /api/challenges error:", error);
    return ApiErrors.internal();
  }
}
