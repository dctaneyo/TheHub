import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastChallengeProgress } from "@/lib/socket-emit";

// GET /api/challenges/[id]/progress — progress for all participants
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { id } = await params;

    // Verify challenge exists in tenant
    const challenge = db
      .select()
      .from(schema.challenges)
      .where(and(eq(schema.challenges.id, id), eq(schema.challenges.tenantId, session.tenantId)))
      .get();

    if (!challenge) return ApiErrors.notFound("Challenge");

    // Get all progress entries grouped by location
    const participants = db
      .select({
        locationId: schema.challengeParticipants.locationId,
        locationName: schema.locations.name,
        storeNumber: schema.locations.storeNumber,
      })
      .from(schema.challengeParticipants)
      .innerJoin(schema.locations, eq(schema.challengeParticipants.locationId, schema.locations.id))
      .where(eq(schema.challengeParticipants.challengeId, id))
      .all();

    const progress = participants.map((p) => {
      const entries = db
        .select()
        .from(schema.challengeProgress)
        .where(
          and(
            eq(schema.challengeProgress.challengeId, id),
            eq(schema.challengeProgress.locationId, p.locationId)
          )
        )
        .all();

      const total = entries.reduce((sum, e) => sum + e.progressValue, 0);

      return {
        locationId: p.locationId,
        locationName: p.locationName,
        storeNumber: p.storeNumber,
        totalProgress: total,
        entries,
      };
    });

    // Sort by total progress descending and add rank
    progress.sort((a, b) => b.totalProgress - a.totalProgress);
    const ranked = progress.map((p, i) => ({ ...p, rank: i + 1 }));

    return apiSuccess({ progress: ranked, challenge });
  } catch (error) {
    console.error("GET /api/challenges/[id]/progress error:", error);
    return ApiErrors.internal();
  }
}

// POST /api/challenges/[id]/progress — record daily progress for a location
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await req.json();
    const { locationId, date, progressValue } = body;

    const effectiveLocationId = locationId || (session.userType === "location" ? session.id : null);
    if (!effectiveLocationId || !date || progressValue === undefined) {
      return ApiErrors.badRequest("Missing required fields: locationId, date, progressValue");
    }

    // Verify challenge exists and is active
    const challenge = db
      .select()
      .from(schema.challenges)
      .where(and(eq(schema.challenges.id, id), eq(schema.challenges.tenantId, session.tenantId)))
      .get();

    if (!challenge) return ApiErrors.notFound("Challenge");
    if (challenge.status !== "active") return ApiErrors.badRequest("Challenge is not active");

    // Check if location is a participant
    const participant = db
      .select()
      .from(schema.challengeParticipants)
      .where(
        and(
          eq(schema.challengeParticipants.challengeId, id),
          eq(schema.challengeParticipants.locationId, effectiveLocationId)
        )
      )
      .get();

    if (!participant) return ApiErrors.badRequest("Location is not a participant in this challenge");

    const now = new Date().toISOString();

    // Upsert: check if entry exists for this date
    const existing = db
      .select()
      .from(schema.challengeProgress)
      .where(
        and(
          eq(schema.challengeProgress.challengeId, id),
          eq(schema.challengeProgress.locationId, effectiveLocationId),
          eq(schema.challengeProgress.date, date)
        )
      )
      .get();

    if (existing) {
      db.update(schema.challengeProgress)
        .set({ progressValue: Number(progressValue), updatedAt: now })
        .where(eq(schema.challengeProgress.id, existing.id))
        .run();
    } else {
      db.insert(schema.challengeProgress).values({
        id: uuid(),
        challengeId: id,
        locationId: effectiveLocationId,
        date,
        progressValue: Number(progressValue),
        updatedAt: now,
      }).run();
    }

    // Calculate rank for broadcast
    const allProgress = db
      .select({
        locationId: schema.challengeParticipants.locationId,
        total: sql<number>`COALESCE(SUM(${schema.challengeProgress.progressValue}), 0)`,
      })
      .from(schema.challengeParticipants)
      .leftJoin(
        schema.challengeProgress,
        and(
          eq(schema.challengeProgress.challengeId, schema.challengeParticipants.challengeId),
          eq(schema.challengeProgress.locationId, schema.challengeParticipants.locationId)
        )
      )
      .where(eq(schema.challengeParticipants.challengeId, id))
      .groupBy(schema.challengeParticipants.locationId)
      .all();

    allProgress.sort((a, b) => b.total - a.total);
    const rank = allProgress.findIndex((p) => p.locationId === effectiveLocationId) + 1;

    // Broadcast progress update
    broadcastChallengeProgress(id, effectiveLocationId, Number(progressValue), rank, session.tenantId);

    return apiSuccess({ recorded: true, rank });
  } catch (error) {
    console.error("POST /api/challenges/[id]/progress error:", error);
    return ApiErrors.internal();
  }
}
