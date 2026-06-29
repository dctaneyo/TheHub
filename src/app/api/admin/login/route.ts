import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { compareSync } from "bcryptjs";
import { signAdminPinPendingToken } from "@/lib/admin-auth";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Step 1 of admin login: email + password. Success returns a short-lived
// pinToken (not a session) — the caller still has to pass the PIN step at
// /api/admin/login/pin before getting an actual session cookie.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`admin-login:${ip}`, { maxAttempts: 5, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const { email, password } = await req.json();
    if (!email || !password) return ApiErrors.badRequest("Email and password are required");

    const admin = db.select().from(schema.platformAdmins).where(eq(schema.platformAdmins.email, email)).get();

    // Generic failure for both "no such admin" and "wrong password" — don't
    // reveal which factor was wrong.
    if (!admin || !admin.isActive || !compareSync(password, admin.passwordHash)) {
      return ApiErrors.unauthorized();
    }

    const pinToken = signAdminPinPendingToken(admin.id);
    return apiSuccess({ success: true, pinToken });
  } catch (error) {
    console.error("Admin login error:", error);
    return ApiErrors.internal();
  }
}
