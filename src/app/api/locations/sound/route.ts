import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { broadcastSoundToggle } from "@/lib/socket-emit";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// GET — dashboard fetches its own mute state on mount
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return ApiErrors.forbidden();
    }
    const loc = db.select({ soundMuted: schema.locations.soundMuted })
      .from(schema.locations)
      .where(eq(schema.locations.id, session.userId))
      .get();
    if (!loc) return ApiErrors.notFound("Location");
    return apiSuccess({ muted: loc.soundMuted });
  } catch (e) {
    console.error("Sound GET error:", e);
    return ApiErrors.internal();
  }
}

// PATCH — ARL or the location itself toggles mute
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { locationId, muted } = await req.json();

    // ARL permission check for muting locations
    if (session.userType === "arl") {
      const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_MUTE);
      if (denied) return denied;
    }

    // ARL can target any location; a location can only toggle itself
    const targetId = session.userType === "arl" ? locationId : session.userId;
    if (!targetId) return ApiErrors.badRequest("locationId required");
    if (session.userType === "location" && targetId !== session.userId) {
      return ApiErrors.forbidden();
    }

    db.update(schema.locations)
      .set({ soundMuted: muted, updatedAt: new Date().toISOString() })
      .where(eq(schema.locations.id, targetId))
      .run();

    broadcastSoundToggle(targetId, muted, session.tenantId);
    return apiSuccess({ muted });
  } catch (e) {
    console.error("Sound PATCH error:", e);
    return ApiErrors.internal();
  }
}
