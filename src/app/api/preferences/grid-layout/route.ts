import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { locations, arls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { broadcastGridLayoutUpdate } from "@/lib/socket-emit";
import { remoteViewSessions } from "@/lib/socket-handlers/state";
import { parseJsonColumn } from "@/lib/json-column";

// Returns the user's saved custom grid layout (JSON) or null if none saved.
//
// Mirror/embed mode: when ?locationId=X&sessionId=Y is provided and the
// caller is an authenticated ARL with an active mirror session for that
// location, return the *location's* layout instead of the ARL's own layout.
// This is the only way the embed iframe can load the correct layout, because
// it runs in the ARL's browser and the cookie authenticates as the ARL.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = req.nextUrl;
    const mirrorLocationId = searchParams.get("locationId");
    const mirrorSessionId = searchParams.get("sessionId");

    // ── Mirror mode: ARL fetching a location's layout ──
    if (
      mirrorLocationId &&
      mirrorSessionId &&
      session.userType === "arl"
    ) {
      // Validate that an active remote-view session exists for this ARL + location
      const rvSession = remoteViewSessions.get(mirrorSessionId);
      if (
        rvSession &&
        rvSession.status === "active" &&
        rvSession.arlId === session.id &&
        rvSession.locationId === mirrorLocationId
      ) {
        const loc = db
          .select({ gridLayout: locations.gridLayout })
          .from(locations)
          .where(eq(locations.id, mirrorLocationId))
          .get();

        const layout = parseJsonColumn<unknown>(loc?.gridLayout, null);
        return apiSuccess({ layout });
      }
      // Session not found or mismatched — fall through to own layout
    }

    // ── Normal mode: return the authenticated user's own layout ──
    let raw: string | null = null;
    if (session.userType === "location") {
      const loc = db
        .select({ gridLayout: locations.gridLayout })
        .from(locations)
        .where(eq(locations.id, session.id))
        .get();
      raw = loc?.gridLayout ?? null;
    } else if (session.userType === "arl") {
      const arl = db
        .select({ gridLayout: arls.gridLayout })
        .from(arls)
        .where(eq(arls.id, session.id))
        .get();
      raw = arl?.gridLayout ?? null;
    }

    const layout = parseJsonColumn<unknown>(raw, null);

    return apiSuccess({ layout });
  } catch (error) {
    console.error("Error fetching grid layout:", error);
    return ApiErrors.internal();
  }
}

// Persists (or clears) the user's custom grid layout.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const body = await req.json();
    const layout = body?.layout ?? null;
    const sourceDeviceId =
      typeof body?.deviceId === "string" ? body.deviceId : undefined;

    // Basic shape validation — must be an object with a widgets array, or null to clear.
    if (layout !== null) {
      if (
        typeof layout !== "object" ||
        !Array.isArray((layout as { widgets?: unknown }).widgets)
      ) {
        return ApiErrors.badRequest("Invalid layout payload");
      }
    }

    const serialized = layout === null ? null : JSON.stringify(layout);

    // Guard against unbounded payloads.
    if (serialized && serialized.length > 20_000) {
      return ApiErrors.badRequest("Layout payload too large");
    }

    if (session.userType === "location") {
      db.update(locations)
        .set({ gridLayout: serialized, updatedAt: new Date().toISOString() })
        .where(eq(locations.id, session.id))
        .run();
    } else if (session.userType === "arl") {
      db.update(arls)
        .set({ gridLayout: serialized, updatedAt: new Date().toISOString() })
        .where(eq(arls.id, session.id))
        .run();
    }

    // Notify this account's other devices so they reflect the change live.
    if (session.userType === "location" || session.userType === "arl") {
      broadcastGridLayoutUpdate(
        session.userType,
        session.id,
        session.tenantId,
        layout,
        sourceDeviceId
      );
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    console.error("Error saving grid layout:", error);
    return ApiErrors.internal();
  }
}
