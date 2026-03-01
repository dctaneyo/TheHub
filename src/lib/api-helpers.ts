import { NextResponse } from "next/server";
import { getSession, type AuthPayload } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { type PermissionKey, parsePermissions, hasPermission } from "@/lib/permissions";

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

/**
 * Check if the current ARL has a specific permission.
 * Returns a 403 response if denied, or null if allowed.
 * Reads the ARL's role + permissions from the DB (fresh, not cached in JWT).
 */
export async function requirePermission(
  session: AuthPayload & { tenantId: string },
  ...keys: PermissionKey[]
): Promise<NextResponse | null> {
  if (session.userType !== "arl") {
    return forbidden("ARL access required");
  }

  // Admins always pass
  const arl = db.select({ role: schema.arls.role, permissions: schema.arls.permissions })
    .from(schema.arls)
    .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId)))
    .get();

  if (!arl) return forbidden("ARL not found");

  const role = arl.role;
  if (role === "admin") return null; // admin = all access

  const perms = parsePermissions(arl.permissions);

  for (const key of keys) {
    if (!hasPermission(role, perms, key)) {
      return forbidden(`You don't have permission: ${key}`);
    }
  }
  return null; // authorized
}

/**
 * Get the current ARL's role and parsed permissions from DB.
 * Useful for returning permissions to the client.
 */
export function getArlPermissions(arlId: string, tenantId: string): { role: string; permissions: PermissionKey[] | null } | null {
  const arl = db.select({ role: schema.arls.role, permissions: schema.arls.permissions })
    .from(schema.arls)
    .where(and(eq(schema.arls.id, arlId), eq(schema.arls.tenantId, tenantId)))
    .get();
  if (!arl) return null;
  return { role: arl.role, permissions: parsePermissions(arl.permissions) };
}
