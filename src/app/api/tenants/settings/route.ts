import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// GET — fetch current tenant settings (any authenticated user)
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const tenant = db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, session.tenantId))
      .get();

    if (!tenant) {
      return ApiErrors.notFound("Tenant");
    }

    return apiSuccess({
      tenant: {
        ...tenant,
        features: JSON.parse(tenant.features || "[]"),
      },
    });
  } catch (error) {
    console.error("Get tenant settings error:", error);
    return ApiErrors.internal();
  }
}

// PUT — update tenant branding (admin ARLs only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    // Only ARLs with admin role can update tenant settings
    if (session.userType !== "arl") {
      return ApiErrors.forbidden("Admin access required");
    }

    // Check if user has admin role
    const arl = db.select().from(schema.arls).where(eq(schema.arls.id, session.userId)).get();
    if (!arl || arl.role !== "admin") {
      return ApiErrors.forbidden("Only tenant admins can update settings");
    }

    const body = await req.json();
    const { name, appTitle, primaryColor, accentColor, logoUrl, faviconUrl, customDomain } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (name !== undefined) updates.name = name;
    if (appTitle !== undefined) updates.appTitle = appTitle;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (accentColor !== undefined) updates.accentColor = accentColor;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (faviconUrl !== undefined) updates.faviconUrl = faviconUrl;
    if (customDomain !== undefined) updates.customDomain = customDomain;

    db.update(schema.tenants)
      .set(updates)
      .where(eq(schema.tenants.id, session.tenantId))
      .run();

    // Return updated tenant
    const updated = db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, session.tenantId))
      .get();

    return apiSuccess({
      success: true,
      tenant: updated ? { ...updated, features: JSON.parse(updated.features || "[]") } : null,
    });
  } catch (error) {
    console.error("Update tenant settings error:", error);
    return ApiErrors.internal();
  }
}
