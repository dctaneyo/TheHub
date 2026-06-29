import { db, schema, sqlite } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";

const ALL_FEATURES = ["messaging", "tasks", "forms", "gamification", "meetings", "analytics", "broadcasts"];

const PLAN_LIMITS: Record<string, { maxLocations: number; maxUsers: number }> = {
  starter: { maxLocations: 10, maxUsers: 5 },
  pro: { maxLocations: 50, maxUsers: 20 },
  enterprise: { maxLocations: 500, maxUsers: 100 },
};

const RESERVED_SLUGS = ["admin", "nimda", "www", "join", "api", "app", "hub", "mail", "ftp", "ns1", "ns2", "test", "staging", "dev"];

export interface ProvisionTenantInput {
  slug: string;
  name: string;
  appTitle?: string;
  primaryColor?: string;
  plan?: string;
  adminName: string;
  adminUserId: string;
  adminPin: string;
  /** Applied after the tenant+ARL transaction commits — copies each brand's standard tasks in. */
  brandIds?: string[];
  /** Platform admin id, recorded as createdBy on copied brand tasks. Self-serve signup omits this. */
  provisionedBy?: string;
}

export type ProvisionTenantResult =
  | { ok: true; tenantId: string; slug: string; adminId: string }
  | { ok: false; error: string };

/**
 * Creates a tenant and its first ARL account in one transaction. Shared by
 * the self-serve signup flow and the Admin Console's tenant-creation route —
 * extracted to avoid a third drifted reimplementation of the same
 * slug/userId/PIN validation and tenant+ARL creation logic.
 */
export async function createTenantWithFirstAdmin(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const { slug, name, appTitle, primaryColor, plan, adminName, adminUserId, adminPin, brandIds, provisionedBy } = input;

  if (!slug || !name || !adminName || !adminUserId || !adminPin) {
    return { ok: false, error: "All fields are required: slug, name, adminName, adminUserId, adminPin" };
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (cleanSlug.length < 3 || cleanSlug.length > 30) {
    return { ok: false, error: "Slug must be 3-30 characters (lowercase letters, numbers, hyphens)" };
  }
  if (RESERVED_SLUGS.includes(cleanSlug)) {
    return { ok: false, error: "This subdomain is reserved" };
  }
  if (!/^\d{4}$/.test(adminUserId)) {
    return { ok: false, error: "Admin user ID must be exactly 4 digits" };
  }
  if (!/^\d{4}$/.test(adminPin)) {
    return { ok: false, error: "Admin PIN must be exactly 4 digits" };
  }

  const existingTenant = db.select().from(schema.tenants).where(eq(schema.tenants.slug, cleanSlug)).get();
  if (existingTenant) {
    return { ok: false, error: "This subdomain is already taken" };
  }

  const existingArl = db.select().from(schema.arls).where(eq(schema.arls.userId, adminUserId)).get();
  const existingLoc = db.select().from(schema.locations).where(eq(schema.locations.userId, adminUserId)).get();
  if (existingArl || existingLoc) {
    return { ok: false, error: "This user ID is already in use" };
  }

  if (brandIds && brandIds.length > 0) {
    for (const brandId of brandIds) {
      const brand = db.select({ id: schema.brands.id }).from(schema.brands).where(eq(schema.brands.id, brandId)).get();
      if (!brand) {
        return { ok: false, error: `Brand not found: ${brandId}` };
      }
    }
  }

  const now = new Date().toISOString();
  const tenantId = cleanSlug; // matches middleware's slug-as-id lookup pattern
  const adminId = uuid();
  const limits = PLAN_LIMITS[plan || "starter"] || PLAN_LIMITS.starter;
  const pinHash = await bcrypt.hash(adminPin, 10);

  const transaction = sqlite.transaction(() => {
    db.insert(schema.tenants).values({
      id: tenantId,
      slug: cleanSlug,
      name,
      appTitle: appTitle || `${name} Hub`,
      primaryColor: primaryColor || "#dc2626",
      plan: plan || "starter",
      features: JSON.stringify(ALL_FEATURES),
      maxLocations: limits.maxLocations,
      maxUsers: limits.maxUsers,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    db.insert(schema.arls).values({
      id: adminId,
      tenantId,
      name: adminName,
      userId: adminUserId,
      pinHash,
      role: "admin",
      permissions: null, // null = all permissions
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    if (brandIds && brandIds.length > 0) {
      for (const brandId of brandIds) {
        db.insert(schema.tenantBrands).values({
          id: uuid(),
          tenantId,
          brandId,
          createdAt: now,
        }).run();

        const templates = db.select().from(schema.brandTaskTemplates).where(eq(schema.brandTaskTemplates.brandId, brandId)).all();
        for (const template of templates) {
          db.insert(schema.tasks).values({
            id: uuid(),
            tenantId,
            title: template.title,
            description: template.description,
            type: template.type,
            priority: template.priority,
            dueTime: template.dueTime,
            isRecurring: template.isRecurring,
            recurringType: template.recurringType,
            recurringDays: template.recurringDays,
            biweeklyStart: template.biweeklyStart,
            locationId: null,
            createdBy: provisionedBy || adminId,
            createdByType: "brand",
            sourceBrandTaskId: template.id,
            points: template.points,
            createdAt: now,
            updatedAt: now,
          }).run();
        }
      }
    }
  });

  transaction();

  return { ok: true, tenantId, slug: cleanSlug, adminId };
}
