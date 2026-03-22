import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Public endpoint – no auth required. Returns only the display name (no PIN hash).
// Rate-limited to prevent user enumeration.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`validate:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 60_000 });
    if (!rl.allowed) {
      return ApiErrors.tooManyRequests(60);
    }

    const { userId } = await req.json();
    if (!userId || userId.length !== 4) {
      return ApiErrors.badRequest("Invalid User ID");
    }

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return ApiErrors.badRequest("Organization context required");
    }

    const location = db.select().from(schema.locations)
      .where(and(eq(schema.locations.userId, userId), eq(schema.locations.tenantId, tenantId))).get();
    if (location) {
      if (!location.isActive) {
        return ApiErrors.notFound("User ID");
      }
      return apiSuccess({ found: true, userType: "location", name: location.name, storeNumber: location.storeNumber });
    }

    const arl = db.select().from(schema.arls)
      .where(and(eq(schema.arls.userId, userId), eq(schema.arls.tenantId, tenantId))).get();
    if (arl) {
      if (!arl.isActive) {
        return ApiErrors.notFound("User ID");
      }
      return apiSuccess({ found: true, userType: "arl", name: arl.name, role: arl.role });
    }

    return ApiErrors.notFound("User ID");
  } catch (error) {
    console.error("Validate user error:", error);
    return ApiErrors.internal();
  }
}
