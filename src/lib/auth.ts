import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. Cannot start in production without it.");
  }
  return "the-hub-dev-secret-key-local-only";
}

export interface AuthPayload {
  id: string;
  tenantId: string; // tenant the user belongs to
  userType: "location" | "arl" | "guest";
  userId: string; // 4-digit user ID
  name: string;
  role?: string; // 'arl' | 'admin' | 'superadmin' for ARLs
  locationId?: string; // for locations
  storeNumber?: string; // for locations
  sessionCode?: string; // unique per login session
  impersonatedBy?: string; // platform admin id, set only on impersonation tokens
  impersonationExpiresAt?: string; // ISO timestamp — enforced server-side in getAuthSession(), independent of the JWT's own exp
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
}

/**
 * Same shape as signToken, but a short 2-hour expiry (not the normal 24h ARL
 * session) and carries impersonatedBy/impersonationExpiresAt so the session
 * is distinguishable from the ARL's own login and independently enforceable.
 */
export function signImpersonationToken(payload: Omit<AuthPayload, "impersonatedBy" | "impersonationExpiresAt">, adminId: string): string {
  const impersonationExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  return jwt.sign(
    { ...payload, impersonatedBy: adminId, impersonationExpiresAt },
    getJwtSecret(),
    { expiresIn: "2h" }
  );
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getTokenExpiry(): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry.toISOString();
}
