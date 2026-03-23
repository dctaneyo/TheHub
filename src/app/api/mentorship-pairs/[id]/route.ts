import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, desc, sql, lte, gte } from "drizzle-orm";
import { broadcastMentorshipXpAwarded } from "@/lib/socket-emit";

// GET /api/mentorship-pairs/[id] — pairing details + improvement stats
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { id } = await params;
    const pair = db
      .select()
      .from(schema.mentorshipPairs)
      .where(and(eq(schema.mentorshipPairs.id, id), eq(schema.mentorshipPairs.tenantId, session.tenantId)))
      .get();

    if (!pair) return ApiErrors.notFound("Mentorship pairing");

    // Location names
    const mentor = db
      .select({ name: schema.locations.name, storeNumber: schema.locations.storeNumber })
      .from(schema.locations)
      .where(eq(schema.locations.id, pair.mentorLocationId))
      .get();
    const mentee = db
      .select({ name: schema.locations.name, storeNumber: schema.locations.storeNumber })
      .from(schema.locations)
      .where(eq(schema.locations.id, pair.menteeLocationId))
      .get();

    // Days paired
    const createdDate = new Date(pair.createdAt);
    const daysPaired = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / 86400000));

    // Compute improvement stats from dailyLeaderboard
    const stats = computeImprovementStats(pair.menteeLocationId, pair.createdAt, pair.tenantId);

    // Bonus XP calculation
    let bonusXP = 0;
    if (stats.improvement >= 10 && pair.status === "active") {
      bonusXP = Math.round(stats.currentAvgPoints * 0.20);
      if (bonusXP > 0) {
        broadcastMentorshipXpAwarded(pair.mentorLocationId, bonusXP, stats.improvement, pair.tenantId);
      }
    }

    return apiSuccess({
      pair: {
        ...pair,
        mentorName: mentor?.name ?? "Unknown",
        mentorStoreNumber: mentor?.storeNumber ?? "",
        menteeName: mentee?.name ?? "Unknown",
        menteeStoreNumber: mentee?.storeNumber ?? "",
        daysPaired,
        baselineAvg: stats.baselineAvg,
        currentAvg: stats.currentAvg,
        improvement: stats.improvement,
        bonusXP,
      },
    });
  } catch (error) {
    console.error("GET /api/mentorship-pairs/[id] error:", error);
    return ApiErrors.internal();
  }
}

// PATCH /api/mentorship-pairs/[id] — dissolve or complete
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return ApiErrors.forbidden("ARL access required");

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !["dissolved", "completed"].includes(status)) {
      return ApiErrors.badRequest("Status must be 'dissolved' or 'completed'");
    }

    const pair = db
      .select()
      .from(schema.mentorshipPairs)
      .where(and(eq(schema.mentorshipPairs.id, id), eq(schema.mentorshipPairs.tenantId, session.tenantId)))
      .get();

    if (!pair) return ApiErrors.notFound("Mentorship pairing");
    if (pair.status !== "active") return ApiErrors.badRequest("Pairing is not active");

    const now = new Date().toISOString();
    db.update(schema.mentorshipPairs)
      .set({ status, endedAt: now })
      .where(eq(schema.mentorshipPairs.id, id))
      .run();

    return apiSuccess({ pair: { id, status, endedAt: now } });
  } catch (error) {
    console.error("PATCH /api/mentorship-pairs/[id] error:", error);
    return ApiErrors.internal();
  }
}

/**
 * Compute improvement stats for a mentee location.
 * Baseline: 7-day avg completion rate around the pairing's createdAt date.
 * Current: most recent 7-day avg completion rate.
 * Completion rate = tasksCompleted / (tasksCompleted + tasksMissed) * 100
 */
function computeImprovementStats(menteeLocationId: string, createdAt: string, tenantId: string) {
  const createdDate = createdAt.slice(0, 10); // YYYY-MM-DD

  // Baseline: 7 days ending at createdAt
  const baselineRows = db
    .select({
      tasksCompleted: schema.dailyLeaderboard.tasksCompleted,
      tasksMissed: schema.dailyLeaderboard.tasksMissed,
      pointsEarned: schema.dailyLeaderboard.pointsEarned,
    })
    .from(schema.dailyLeaderboard)
    .where(
      and(
        eq(schema.dailyLeaderboard.locationId, menteeLocationId),
        eq(schema.dailyLeaderboard.tenantId, tenantId),
        lte(schema.dailyLeaderboard.date, createdDate)
      )
    )
    .orderBy(desc(schema.dailyLeaderboard.date))
    .limit(7)
    .all();

  // Current: most recent 7 days
  const currentRows = db
    .select({
      tasksCompleted: schema.dailyLeaderboard.tasksCompleted,
      tasksMissed: schema.dailyLeaderboard.tasksMissed,
      pointsEarned: schema.dailyLeaderboard.pointsEarned,
    })
    .from(schema.dailyLeaderboard)
    .where(
      and(
        eq(schema.dailyLeaderboard.locationId, menteeLocationId),
        eq(schema.dailyLeaderboard.tenantId, tenantId)
      )
    )
    .orderBy(desc(schema.dailyLeaderboard.date))
    .limit(7)
    .all();

  function avgCompletionRate(rows: { tasksCompleted: number; tasksMissed: number }[]) {
    if (rows.length === 0) return 0;
    const totalCompleted = rows.reduce((s, r) => s + r.tasksCompleted, 0);
    const totalTasks = rows.reduce((s, r) => s + r.tasksCompleted + r.tasksMissed, 0);
    return totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);
  }

  function avgPoints(rows: { pointsEarned: number }[]) {
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((s, r) => s + r.pointsEarned, 0) / rows.length);
  }

  const baselineAvg = avgCompletionRate(baselineRows);
  const currentAvg = avgCompletionRate(currentRows);
  const improvement = currentAvg - baselineAvg;
  const currentAvgPoints = avgPoints(currentRows);

  return { baselineAvg, currentAvg, improvement, currentAvgPoints };
}
