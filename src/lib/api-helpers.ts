import { NextResponse } from "next/server";
import { getSession, type AuthPayload } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get authenticated session with tenant context.
 * Returns session with guaranteed tenantId, or null if not authenticated.
 */
export async function getAuthSession(): Promise<(AuthPayload & { tenantId: string }) | null> {
  const session = await getSession();
  if (!session) return null;

  // Get tenant from header (set by middleware) — fallback to session's tenantId
  const h = await headers();
  const headerTenantId = h.get("x-tenant-id");
  const tenantId = headerTenantId || session.tenantId || "kazi";

  return { ...session, tenantId };
}

/**
 * Get tenantId from request headers (for routes that don't need full auth).
 */
export async function getTenantIdFromHeaders(): Promise<string> {
  const h = await headers();
  return h.get("x-tenant-id") || "kazi";
}

/**
 * Standard unauthorized response.
 */
export function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * Standard forbidden response.
 */
export function forbidden(msg = "Not authorized") {
  return NextResponse.json({ error: msg }, { status: 403 });
}
