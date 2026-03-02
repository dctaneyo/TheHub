import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

// Public endpoint – no auth required. Returns only the display name (no PIN hash).
// Rate-limited to prevent user enumeration.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`validate:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { userId } = await req.json();
    if (!userId || userId.length !== 4) {
      return NextResponse.json({ error: "Invalid User ID" }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "kazi";

    const location = db.select().from(schema.locations)
      .where(and(eq(schema.locations.userId, userId), eq(schema.locations.tenantId, tenantId))).get();
    if (location) {
      if (!location.isActive) {
        return NextResponse.json({ error: "User ID not found" }, { status: 404 });
      }
      return NextResponse.json({ found: true, userType: "location", name: location.name, storeNumber: location.storeNumber });
    }

    const arl = db.select().from(schema.arls)
      .where(and(eq(schema.arls.userId, userId), eq(schema.arls.tenantId, tenantId))).get();
    if (arl) {
      if (!arl.isActive) {
        return NextResponse.json({ error: "User ID not found" }, { status: 404 });
      }
      return NextResponse.json({ found: true, userType: "arl", name: arl.name, role: arl.role });
    }

    return NextResponse.json({ error: "User ID not found" }, { status: 404 });
  } catch (error) {
    console.error("Validate user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
