import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { compareSync } from "bcryptjs";
import { getJwtSecret } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * Platform admin session payload. Deliberately has no tenantId/userType —
 * if this ever gets read by ARL/location session logic by mistake, it fails
 * closed instead of being misinterpreted as a tenant-scoped session.
 */
export interface AdminAuthPayload {
  adminId: string;
  email: string;
  name: string;
}

interface AdminPinPendingPayload {
  adminId: string;
  purpose: "admin-pin-pending";
}

/** Step 1 (password) success issues this — proof the password was correct, not yet a session. */
export function signAdminPinPendingToken(adminId: string): string {
  return jwt.sign({ adminId, purpose: "admin-pin-pending" }, getJwtSecret(), { expiresIn: "5m" });
}

export function verifyAdminPinPendingToken(token: string): { adminId: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AdminPinPendingPayload;
    if (decoded.purpose !== "admin-pin-pending" || !decoded.adminId) return null;
    return { adminId: decoded.adminId };
  } catch {
    return null;
  }
}

/** Step 2 (PIN) success issues the real admin session token. */
export function signAdminSessionToken(payload: AdminAuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
}

export function verifyAdminSessionToken(token: string): AdminAuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AdminAuthPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminAuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-admin-token")?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

/**
 * Re-checks the PIN for an already-authenticated admin, used to gate every
 * destructive action (force-logout, ARL PIN reset, tenant delete, every
 * Data Management purge) regardless of how recently they logged in. Same
 * account-keyed lockout as the PIN login step — 5 attempts before lockout —
 * so this can't be brute-forced just because the session itself is valid.
 */
export function verifyAdminPinReconfirmation(adminId: string, pin: string): { ok: true } | { ok: false; error: string } {
  const rl = checkRateLimit(`admin-pin-reconfirm:${adminId}`, { maxAttempts: 5, windowMs: 10 * 60_000, lockoutMs: 15 * 60_000 });
  if (!rl.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((rl.retryAfterMs || 0) / 1000)}s.` };
  }

  const admin = db.select({ pinHash: schema.platformAdmins.pinHash, isActive: schema.platformAdmins.isActive })
    .from(schema.platformAdmins)
    .where(eq(schema.platformAdmins.id, adminId))
    .get();

  if (!admin || !admin.isActive || !compareSync(pin, admin.pinHash)) {
    return { ok: false, error: "Incorrect PIN" };
  }

  return { ok: true };
}
