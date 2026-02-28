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
}

/**
 * Resolve tenant from the x-tenant-id header (set by middleware).
 * Returns null if no tenant found or tenant is inactive.
 */
export async function getTenant(): Promise<Tenant | null> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return null;

  const row = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();

  if (!row || !row.isActive) return null;

  return {
    ...row,
    features: JSON.parse(row.features || "[]") as string[],
  };
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
