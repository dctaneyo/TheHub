import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { locations, arls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Returns the user's saved custom grid layout (JSON) or null if none saved.
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

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

    let layout: unknown = null;
    if (raw) {
      try {
        layout = JSON.parse(raw);
      } catch {
        layout = null;
      }
    }

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

    return apiSuccess({ ok: true });
  } catch (error) {
    console.error("Error saving grid layout:", error);
    return ApiErrors.internal();
  }
}
