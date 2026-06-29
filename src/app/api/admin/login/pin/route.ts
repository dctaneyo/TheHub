import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { compareSync } from "bcryptjs";
import { verifyAdminPinPendingToken, signAdminSessionToken } from "@/lib/admin-auth";
import { touchAdminActivity } from "@/lib/admin-session-activity";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limiter";
import { ApiErrors } from "@/lib/api-response";
import { NextResponse } from "next/server";

// Step 2 of admin login: the 6-digit PIN. Requires a valid pinToken from
// step 1. Locked out by admin id, not just IP — an attacker who already has
// a valid password could otherwise spread PIN-guessing attempts across many
// IPs to evade a single IP's lockout.
export async function POST(req: NextRequest) {
  try {
    const { pinToken, pin } = await req.json();
    if (!pinToken || !pin) return ApiErrors.badRequest("pinToken and pin are required");

    const pending = verifyAdminPinPendingToken(pinToken);
    if (!pending) return ApiErrors.unauthorized();

    const rl = checkRateLimit(`admin-pin:${pending.adminId}`, { maxAttempts: 5, windowMs: 10 * 60_000, lockoutMs: 15 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const admin = db.select().from(schema.platformAdmins).where(eq(schema.platformAdmins.id, pending.adminId)).get();

    if (!admin || !admin.isActive || !compareSync(pin, admin.pinHash)) {
      return ApiErrors.unauthorized();
    }

    resetRateLimit(`admin-pin:${pending.adminId}`);
    touchAdminActivity(admin.id);

    const token = signAdminSessionToken({ adminId: admin.id, email: admin.email, name: admin.name });

    const response = NextResponse.json({ ok: true, success: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
    response.cookies.set("hub-admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Admin PIN login error:", error);
    return ApiErrors.internal();
  }
}
