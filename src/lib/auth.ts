import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "the-hub-secret-key-change-in-production";

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
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
