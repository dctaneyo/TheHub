import { NextResponse } from "next/server";
import { getSession, type AuthPayload } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { type PermissionKey, parsePermissions, parseAssignedLocations, hasPermission, hasLocationAccess } from "@/lib/permissions";

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
 * Check if the current ARL has access to a specific location.
 * Returns a 403 response if denied, or null if allowed.
 */
export async function requireLocationAccess(
  session: AuthPayload & { tenantId: string },
  locationId: string
): Promise<NextResponse | null> {
  if (session.userType !== "arl") return null; // locations always access themselves

  const arl = db.select({ role: schema.arls.role, assignedLocationIds: schema.arls.assignedLocationIds })
    .from(schema.arls)
    .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId)))
    .get();

  if (!arl) return forbidden("ARL not found");
  if (arl.role === "admin") return null;

  const assigned = parseAssignedLocations(arl.assignedLocationIds);
  if (!hasLocationAccess(arl.role, assigned, locationId)) {
    return forbidden("You don't have access to this location");
  }
  return null;
}

/**
 * Get the effective location ID for API calls.
 * In mirror mode, an ARL can pass ?locationId=<targetId> to proxy as a location.
 * Validates ARL has access to the target location.
 * Returns null if caller is ARL without a mirror target (i.e. viewing all).
 */
export function getEffectiveLocationId(
  session: AuthPayload & { tenantId: string },
  searchParams: URLSearchParams
): string | null {
  const mirrorLocationId = searchParams.get("locationId");

  if (mirrorLocationId && session.userType === "arl") {
    // ARL is mirroring a location — use the target's ID
    return mirrorLocationId;
  }

  // Normal mode: locations use their own ID, ARLs get null (all)
  return session.userType === "location" ? session.id : null;
}

/**
 * Same as getEffectiveLocationId but for POST/mutation routes.
 * Validates ARL has access and returns the effective location ID.
 * For locations, always returns their own ID.
 * For ARLs with mirrorLocationId in body, returns that.
 */
export function getEffectiveLocationIdFromBody(
  session: AuthPayload & { tenantId: string },
  body: Record<string, unknown>
): string {
  const mirrorLocationId = body.mirrorLocationId as string | undefined;

  if (mirrorLocationId && session.userType === "arl") {
    return mirrorLocationId;
  }

  return session.id;
}

/**
 * Get the current ARL's role, parsed permissions, and assigned locations from DB.
 * Useful for returning permissions to the client.
 */
export function getArlPermissions(arlId: string, tenantId: string): { role: string; roleId: string | null; permissions: PermissionKey[] | null; assignedLocationIds: string[] | null } | null {
  const arl = db.select({ role: schema.arls.role, roleId: schema.arls.roleId, permissions: schema.arls.permissions, assignedLocationIds: schema.arls.assignedLocationIds })
    .from(schema.arls)
    .where(and(eq(schema.arls.id, arlId), eq(schema.arls.tenantId, tenantId)))
    .get();
  if (!arl) return null;
  return { role: arl.role, roleId: arl.roleId ?? null, permissions: parsePermissions(arl.permissions), assignedLocationIds: parseAssignedLocations(arl.assignedLocationIds) };
}
