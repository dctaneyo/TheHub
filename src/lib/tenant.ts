import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  faviconUrl: string | null;
  appTitle: string | null;
  plan: string;
  features: string[];
  maxLocations: number;
  maxUsers: number;
  isActive: boolean;
  customDomain: string | null;
  timezone: string;
}

/**
 * Resolve tenant from the x-tenant-id header (set by middleware).
 * Returns null if no tenant found or tenant is inactive.
 * Results are cached in-memory for 60s to avoid repeated DB lookups.
 */

const tenantCache = new Map<string, { tenant: Tenant; expiresAt: number }>();
const TENANT_CACHE_TTL = 60_000; // 60 seconds

export async function getTenant(): Promise<Tenant | null> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return null;

  // Check cache
  const cached = tenantCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  const row = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();

  if (!row || !row.isActive) return null;

  const tenant: Tenant = {
    ...row,
    features: JSON.parse(row.features || "[]") as string[],
  };

  tenantCache.set(tenantId, { tenant, expiresAt: Date.now() + TENANT_CACHE_TTL });
  return tenant;
}

/** Invalidate tenant cache (call after settings update). */
export function invalidateTenantCache(tenantId: string) {
  tenantCache.delete(tenantId);
}

/**
 * Get just the tenantId from headers (lighter — no DB lookup).
 * Throws if missing (use in protected API routes only).
 */
export async function requireTenantId(): Promise<string> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) throw new Error("Missing tenant context");
  return tenantId;
}

/**
 * Resolve tenant by slug or custom domain (used by middleware).
 * This runs raw SQL since middleware runs before Drizzle proxy is ready.
 */
export function resolveTenantByHost(host: string): { id: string; slug: string } | null {
  // Strip port if present
  const hostname = host.split(":")[0];

  // Known system subdomains that aren't tenants
  const systemHosts = ["join", "www", "admin", "api"];

  // Extract subdomain from *.meetthehub.com or *.meethehub.com
  const hubDomains = ["meetthehub.com", "meethehub.com"];
  for (const domain of hubDomains) {
    if (hostname.endsWith(`.${domain}`)) {
      const sub = hostname.replace(`.${domain}`, "");
      if (systemHosts.includes(sub)) return null; // system subdomain, not a tenant
      // Look up tenant by slug
      const row = db
        .select({ id: schema.tenants.id, slug: schema.tenants.slug })
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, sub))
        .get();
      return row || null;
    }
    // Bare domain (no subdomain)
    if (hostname === domain) return null;
  }

  // Check for custom domain
  const row = db
    .select({ id: schema.tenants.id, slug: schema.tenants.slug })
    .from(schema.tenants)
    .where(eq(schema.tenants.customDomain, hostname))
    .get();
  return row || null;
}

/**
 * Check if tenant has a specific feature enabled.
 */
export function hasFeature(tenant: Tenant, feature: string): boolean {
  return tenant.features.includes(feature);
}

/**
 * Check if tenant can add more locations (within maxLocations limit).
 */
export function canAddLocation(tenantId: string, maxLocations: number): boolean {
  const count = db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(eq(schema.locations.tenantId, tenantId))
    .all().length;
  return count < maxLocations;
}

/**
 * Check if tenant can add more users/ARLs (within maxUsers limit).
 */
export function canAddUser(tenantId: string, maxUsers: number): boolean {
  const count = db
    .select({ id: schema.arls.id })
    .from(schema.arls)
    .where(eq(schema.arls.tenantId, tenantId))
    .all().length;
  return count < maxUsers;
}

/**
 * Server-side feature check. Returns a 403 NextResponse if the tenant
 * doesn't have the feature, or null if allowed.
 * Usage in API routes:
 *   const denied = requireFeature(tenant, "meetings");
 *   if (denied) return denied;
 */
export function requireFeature(tenant: Tenant, feature: string): Response | null {
  if (hasFeature(tenant, feature)) return null;
  return Response.json(
    { error: `Feature "${feature}" is not available on your ${tenant.plan} plan` },
    { status: 403 }
  );
}

/**
 * Full plan limit check. Returns an object describing whether the tenant
 * can add more locations/users and their current usage.
 */
export function getPlanUsage(tenantId: string, tenant: Tenant) {
  const locationCount = db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(eq(schema.locations.tenantId, tenantId))
    .all().length;

  const userCount = db
    .select({ id: schema.arls.id })
    .from(schema.arls)
    .where(eq(schema.arls.tenantId, tenantId))
    .all().length;

  return {
    plan: tenant.plan,
    locations: { current: locationCount, max: tenant.maxLocations, canAdd: locationCount < tenant.maxLocations },
    users: { current: userCount, max: tenant.maxUsers, canAdd: userCount < tenant.maxUsers },
    features: tenant.features,
  };
}
