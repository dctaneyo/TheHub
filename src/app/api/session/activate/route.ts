import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, getTokenExpiry, type AuthPayload } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastSessionActivated } from "@/lib/socket-emit";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

function genSessionCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST - ARL activates a pending session by assigning it to a location or ARL account
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`activate:${ip}`, { maxAttempts: 20, windowMs: 60_000, lockoutMs: 2 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden();
    }

    const { pendingId, assignToType, assignToId } = await req.json();

    if (!pendingId || !assignToType || !assignToId) {
      return ApiErrors.badRequest("pendingId, assignToType, and assignToId are required");
    }

    if (!["location", "arl"].includes(assignToType)) {
      return ApiErrors.badRequest("assignToType must be 'location' or 'arl'");
    }

    // Find the pending session
    const pending = db
      .select()
      .from(schema.pendingSessions)
      .where(eq(schema.pendingSessions.id, pendingId))
      .get();

    if (!pending) {
      return ApiErrors.notFound("Pending session");
    }

    if (pending.status !== "pending") {
      return ApiErrors.badRequest("Session already activated");
    }

    if (new Date(pending.expiresAt) < new Date()) {
      return ApiErrors.badRequest("Pending session has expired");
    }

    // Look up the target account
    let token: string;
    let redirectTo: string;
    let targetName: string;
    const sessionCode = genSessionCode();

    if (assignToType === "location") {
      const location = db.select().from(schema.locations).where(and(eq(schema.locations.id, assignToId), eq(schema.locations.tenantId, session.tenantId))).get();
      if (!location) return ApiErrors.notFound("Location");
      if (!location.isActive) return ApiErrors.forbidden("Location is deactivated");

      const payload: AuthPayload = {
        id: location.id,
        tenantId: location.tenantId || "kazi",
        userType: "location",
        userId: location.userId,
        name: location.name,
        locationId: location.id,
        storeNumber: location.storeNumber,
        sessionCode,
      };
      token = signToken(payload);
      redirectTo = "/dashboard";
      targetName = location.name;

      // Create a real session record
      db.insert(schema.sessions).values({
        id: uuid(),
        sessionCode,
        userType: "location",
        userId: location.id,
        token,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceType: "kiosk",
        createdAt: new Date().toISOString(),
        expiresAt: getTokenExpiry(),
      }).run();
    } else {
      const arl = db.select().from(schema.arls).where(and(eq(schema.arls.id, assignToId), eq(schema.arls.tenantId, session.tenantId))).get();
      if (!arl) return ApiErrors.notFound("ARL");
      if (!arl.isActive) return ApiErrors.forbidden("ARL account is deactivated");

      const payload: AuthPayload = {
        id: arl.id,
        tenantId: arl.tenantId || "kazi",
        userType: "arl",
        userId: arl.userId,
        name: arl.name,
        role: arl.role,
        sessionCode,
      };
      token = signToken(payload);
      redirectTo = "/arl";
      targetName = arl.name;

      // Create a real session record
      db.insert(schema.sessions).values({
        id: uuid(),
        sessionCode,
        userType: "arl",
        userId: arl.id,
        token,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceType: "desktop",
        createdAt: new Date().toISOString(),
        expiresAt: getTokenExpiry(),
      }).run();
    }

    // Update the pending session with the activation info
    db.update(schema.pendingSessions)
      .set({
        status: "activated",
        assignedUserType: assignToType,
        assignedUserId: assignToId,
        activatedBy: session.id,
        token,
        redirectTo,
        activatedAt: new Date().toISOString(),
      })
      .where(eq(schema.pendingSessions.id, pendingId))
      .run();

    // Instantly notify login page watcher + ARLs
    broadcastSessionActivated(pendingId, session.tenantId);

    return apiSuccess({
      targetName,
      redirectTo,
    });
  } catch (error) {
    console.error("Activate session error:", error);
    return ApiErrors.internal();
  }
}
