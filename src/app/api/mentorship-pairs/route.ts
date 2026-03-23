import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET /api/mentorship-pairs — list pairings for tenant
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const conditions = [eq(schema.mentorshipPairs.tenantId, session.tenantId)];
    if (status && ["active", "completed", "dissolved"].includes(status)) {
      conditions.push(eq(schema.mentorshipPairs.status, status));
    }

    const pairs = db
      .select()
      .from(schema.mentorshipPairs)
      .where(and(...conditions))
      .orderBy(desc(schema.mentorshipPairs.createdAt))
      .all();

    // Enrich with location names
    const enriched = pairs.map((p) => {
      const mentor = db
        .select({ name: schema.locations.name, storeNumber: schema.locations.storeNumber })
        .from(schema.locations)
        .where(eq(schema.locations.id, p.mentorLocationId))
        .get();
      const mentee = db
        .select({ name: schema.locations.name, storeNumber: schema.locations.storeNumber })
        .from(schema.locations)
        .where(eq(schema.locations.id, p.menteeLocationId))
        .get();
      return {
        ...p,
        mentorName: mentor?.name ?? "Unknown",
        mentorStoreNumber: mentor?.storeNumber ?? "",
        menteeName: mentee?.name ?? "Unknown",
        menteeStoreNumber: mentee?.storeNumber ?? "",
      };
    });

    return apiSuccess({ pairs: enriched });
  } catch (error) {
    console.error("GET /api/mentorship-pairs error:", error);
    return ApiErrors.internal();
  }
}

// POST /api/mentorship-pairs — create pairing (ARL only)
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return ApiErrors.forbidden("ARL access required");

    const body = await req.json();
    const { mentorLocationId, menteeLocationId } = body;

    if (!mentorLocationId || !menteeLocationId) {
      return ApiErrors.badRequest("Mentor and mentee location IDs are required");
    }
    if (mentorLocationId === menteeLocationId) {
      return ApiErrors.badRequest("Mentor and mentee cannot be the same location");
    }

    // Check for active duplicates — neither location should be in an active pairing
    const activePairs = db
      .select()
      .from(schema.mentorshipPairs)
      .where(
        and(
          eq(schema.mentorshipPairs.tenantId, session.tenantId),
          eq(schema.mentorshipPairs.status, "active")
        )
      )
      .all();

    const conflict = activePairs.find(
      (p) =>
        p.mentorLocationId === mentorLocationId ||
        p.mentorLocationId === menteeLocationId ||
        p.menteeLocationId === mentorLocationId ||
        p.menteeLocationId === menteeLocationId
    );

    if (conflict) {
      return apiError("DUPLICATE_PAIRING", "One or both locations are already in an active mentorship pairing", 409);
    }

    const id = uuid();
    db.insert(schema.mentorshipPairs)
      .values({
        id,
        tenantId: session.tenantId,
        mentorLocationId,
        menteeLocationId,
        status: "active",
        createdBy: session.id,
      })
      .run();

    return apiSuccess({ pair: { id, mentorLocationId, menteeLocationId, status: "active" } }, 201);
  } catch (error) {
    console.error("POST /api/mentorship-pairs error:", error);
    return ApiErrors.internal();
  }
}
