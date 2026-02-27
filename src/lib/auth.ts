import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. Cannot start in production without it.");
  }
  return "the-hub-dev-secret-key-local-only";
}

export interface AuthPayload {
  id: string;
  userType: "location" | "arl" | "guest";
  userId: string; // 4-digit user ID
  name: string;
  role?: string; // 'arl' | 'admin' for ARLs
  locationId?: string; // for locations
  storeNumber?: string; // for locations
  sessionCode?: string; // unique per login session
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
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
