import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

// GET /api/challenges/[id] — challenge details + leaderboard
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { id } = await params;

    const challenge = db
      .select()
      .from(schema.challenges)
      .where(and(eq(schema.challenges.id, id), eq(schema.challenges.tenantId, session.tenantId)))
      .get();

    if (!challenge) return ApiErrors.notFound("Challenge");

    // Get participants with location names
    const participants = db
      .select({
        locationId: schema.challengeParticipants.locationId,
        locationName: schema.locations.name,
        storeNumber: schema.locations.storeNumber,
        joinedAt: schema.challengeParticipants.joinedAt,
      })
      .from(schema.challengeParticipants)
      .innerJoin(schema.locations, eq(schema.challengeParticipants.locationId, schema.locations.id))
      .where(eq(schema.challengeParticipants.challengeId, id))
      .all();

    // Build leaderboard: sum progressValue per location
    const leaderboard = participants.map((p) => {
      const progress = db
        .select({ total: sql<number>`COALESCE(SUM(${schema.challengeProgress.progressValue}), 0)` })
        .from(schema.challengeProgress)
        .where(
          and(
            eq(schema.challengeProgress.challengeId, id),
            eq(schema.challengeProgress.locationId, p.locationId)
          )
        )
        .get();

      return {
        locationId: p.locationId,
        locationName: p.locationName,
        storeNumber: p.storeNumber,
        totalProgress: progress?.total ?? 0,
      };
    });

    // Sort by progress descending
    leaderboard.sort((a, b) => b.totalProgress - a.totalProgress);

    // Add rank
    const ranked = leaderboard.map((entry, i) => ({ ...entry, rank: i + 1 }));

    return apiSuccess({ challenge, leaderboard: ranked });
  } catch (error) {
    console.error("GET /api/challenges/[id] error:", error);
    return ApiErrors.internal();
  }
}

// PATCH /api/challenges/[id] — update status (end/cancel), set winner
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return ApiErrors.forbidden("ARL access required");

    const { id } = await params;
    const body = await req.json();
    const { status, winnerLocationId } = body;

    const challenge = db
      .select()
      .from(schema.challenges)
      .where(and(eq(schema.challenges.id, id), eq(schema.challenges.tenantId, session.tenantId)))
      .get();

    if (!challenge) return ApiErrors.notFound("Challenge");

    if (status && !["completed", "cancelled"].includes(status)) {
      return ApiErrors.badRequest("Status must be 'completed' or 'cancelled'");
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (status) updates.status = status;
    if (winnerLocationId) updates.winnerLocationId = winnerLocationId;

    db.update(schema.challenges)
      .set(updates)
      .where(eq(schema.challenges.id, id))
      .run();

    return apiSuccess({ challenge: { id, ...updates } });
  } catch (error) {
    console.error("PATCH /api/challenges/[id] error:", error);
    return ApiErrors.internal();
  }
}
