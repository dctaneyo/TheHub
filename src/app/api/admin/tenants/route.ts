import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { parseJsonColumn } from "@/lib/json-column";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { createTenantWithFirstAdmin } from "@/lib/tenant-provisioning";
import { logAudit } from "@/lib/audit-logger";

// GET all tenants with stats + passive backup-health signal
export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const allTenants = db.select().from(schema.tenants).all();

    const tenants = allTenants.map((t) => {
      const locationCount = db.select().from(schema.locations).where(eq(schema.locations.tenantId, t.id)).all().length;
      const userCount = db.select().from(schema.arls).where(eq(schema.arls.tenantId, t.id)).all().length;
      const brandTags = db.select({ name: schema.brands.name, primaryColor: schema.brands.primaryColor })
        .from(schema.tenantBrands)
        .innerJoin(schema.brands, eq(schema.tenantBrands.brandId, schema.brands.id))
        .where(eq(schema.tenantBrands.tenantId, t.id))
        .all();

      return {
        ...t,
        features: parseJsonColumn(t.features, []),
        locationCount,
        userCount,
        brands: brandTags,
      };
    });

    return apiSuccess({ tenants });
  } catch (error) {
    console.error("Get tenants error:", error);
    return ApiErrors.internal();
  }
}

// POST — provision a new tenant (tenant + first ARL + optional brand task copy-in)
export async function POST(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const { slug, name, appTitle, primaryColor, plan, adminName, adminUserId, adminPin, brandIds } = body;

    const result = await createTenantWithFirstAdmin({
      slug, name, appTitle, primaryColor, plan, adminName, adminUserId, adminPin,
      brandIds, provisionedBy: auth.session.adminId,
    });

    if (!result.ok) return ApiErrors.badRequest(result.error);

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "tenant_provisioned",
      entityType: "tenant", tenantId: result.tenantId,
      payload: { slug: result.slug, brandIds: brandIds || [] }, status: "success",
    });

    return apiSuccess({ id: result.tenantId, slug: result.slug, adminId: result.adminId });
  } catch (error) {
    console.error("Create tenant error:", error);
    return ApiErrors.internal();
  }
}

// PUT update tenant
export async function PUT(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const { id, name, appTitle, primaryColor, plan, features, maxLocations, maxUsers, customDomain, isActive } = body;

    if (!id) return ApiErrors.badRequest("ID required");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (appTitle !== undefined) updates.appTitle = appTitle;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (plan !== undefined) updates.plan = plan;
    if (features !== undefined) updates.features = JSON.stringify(features);
    if (maxLocations !== undefined) updates.maxLocations = maxLocations;
    if (maxUsers !== undefined) updates.maxUsers = maxUsers;
    if (customDomain !== undefined) updates.customDomain = customDomain;
    if (isActive !== undefined) updates.isActive = isActive;

    db.update(schema.tenants).set(updates).where(eq(schema.tenants.id, id)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "tenant_updated", entityType: "tenant", tenantId: id, payload: updates, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Update tenant error:", error);
    return ApiErrors.internal();
  }
}

// DELETE tenant — PIN re-confirmation required, this is the highest-stakes
// action in the whole console (soft-delete: marks inactive, doesn't purge data).
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id, pin } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");
    if (!pin) return ApiErrors.badRequest("PIN required");

    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    if (id === "kazi") {
      return ApiErrors.forbidden("Cannot delete the primary tenant");
    }

    db.update(schema.tenants)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(schema.tenants.id, id))
      .run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "tenant_deleted", entityType: "tenant", tenantId: id, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete tenant error:", error);
    return ApiErrors.internal();
  }
}
