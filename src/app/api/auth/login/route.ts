import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { compareSync } from "bcryptjs";
import { signToken, getTokenExpiry, type AuthPayload } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { broadcastSessionUpdated } from "@/lib/socket-emit";
import { checkRateLimit, resetRateLimit, getClientIP } from "@/lib/rate-limiter";
import { validate, loginSchema } from "@/lib/validations";
import { ApiErrors } from "@/lib/api-response";

function genSessionCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`login:${ip}`, { maxAttempts: 5, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) {
      const retrySeconds = Math.ceil((rl.retryAfterMs || 0) / 1000);
      return ApiErrors.tooManyRequests(retrySeconds);
    }

    const body = await req.json();
    const parsed = validate(loginSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Invalid credentials");
    }
    const { userId, pin, orgSlug } = parsed.data;

    // Resolve tenant: prefer explicit orgSlug from body, fall back to middleware header
    let tenantId = req.headers.get("x-tenant-id");
    if (orgSlug) {
      // Look up tenant by slug to get the tenant ID
      const tenant = db
        .select({ id: schema.tenants.id })
        .from(schema.tenants)
        .where(and(eq(schema.tenants.slug, orgSlug.toLowerCase()), eq(schema.tenants.isActive, true)))
        .get();
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    if (!tenantId) {
      return ApiErrors.badRequest("Organization context required");
    }

    // Try to find as location first (scoped to tenant)
    const location = db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.userId, userId), eq(schema.locations.tenantId, tenantId)))
      .get();

    if (location) {
      if (!location.isActive) {
        return ApiErrors.unauthorized();
      }

      if (!compareSync(pin, location.pinHash)) {
        return ApiErrors.unauthorized();
      }

      const sessionCode = genSessionCode();
      const payload: AuthPayload = {
        id: location.id,
        tenantId,
        userType: "location",
        userId: location.userId,
        name: location.name,
        locationId: location.id,
        storeNumber: location.storeNumber,
        sessionCode,
      };

      const token = signToken(payload);
      const expiresAt = getTokenExpiry();

      // Mark any existing sessions for this user offline before creating new one
      db.update(schema.sessions)
        .set({ isOnline: false })
        .where(eq(schema.sessions.userId, location.id))
        .run();

      // Create session
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
        expiresAt,
      }).run();

      resetRateLimit(`login:${ip}`);

      // Cookie needs to be set, so keep NextResponse.json
      const response = NextResponse.json({
        ok: true,
        success: true,
        userType: "location",
        sessionCode,
        user: {
          id: location.id,
          name: location.name,
          storeNumber: location.storeNumber,
          userType: "location",
        },
      });

      response.cookies.set("hub-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return response;
    }

    // Try as ARL (scoped to tenant)
    const arl = db
      .select()
      .from(schema.arls)
      .where(and(eq(schema.arls.userId, userId), eq(schema.arls.tenantId, tenantId)))
      .get();

    if (arl) {
      if (!arl.isActive) {
        return ApiErrors.unauthorized();
      }

      if (!compareSync(pin, arl.pinHash)) {
        return ApiErrors.unauthorized();
      }

      resetRateLimit(`login:${ip}`);

      // Detect device type from user agent
      const ua = req.headers.get("user-agent") || "";
      let deviceType = "desktop";
      if (/mobile/i.test(ua)) deviceType = "mobile";
      else if (/tablet|ipad/i.test(ua)) deviceType = "tablet";

      const sessionCode = genSessionCode();
      const payload: AuthPayload = {
        id: arl.id,
        tenantId,
        userType: "arl",
        userId: arl.userId,
        name: arl.name,
        role: arl.role,
        sessionCode,
      };

      const token = signToken(payload);
      const expiresAt = getTokenExpiry();

      // Mark any existing sessions for this user offline before creating new one
      db.update(schema.sessions)
        .set({ isOnline: false })
        .where(eq(schema.sessions.userId, arl.id))
        .run();

      // Create session
      db.insert(schema.sessions).values({
        id: uuid(),
        sessionCode,
        userType: "arl",
        userId: arl.id,
        token,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceType,
        createdAt: new Date().toISOString(),
        expiresAt,
      }).run();

      // Cookie needs to be set, so keep NextResponse.json
      const response = NextResponse.json({
        ok: true,
        success: true,
        userType: "arl",
        sessionCode,
        user: {
          id: arl.id,
          name: arl.name,
          role: arl.role,
          userType: "arl",
        },
      });

      response.cookies.set("hub-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24,
        path: "/",
      });

      return response;
    }

    // Generic error — don't reveal whether user exists
    return ApiErrors.unauthorized();
  } catch (error) {
    console.error("Login error:", error);
    return ApiErrors.internal();
  }
}
