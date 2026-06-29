import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { getAuditLog } from "@/lib/audit-logger";

// GET — Tenant Overview: stats, brand tags, recent audit slice, ARL list.
// One investigate-a-tenant task, one page — see the plan's Layout Intent
// section for why this isn't split into tabs.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;

    const tenant = db.select().from(schema.tenants).where(eq(schema.tenants.id, id)).get();
    if (!tenant) return ApiErrors.notFound("Tenant");

    const locationCount = db.select().from(schema.locations).where(eq(schema.locations.tenantId, id)).all().length;

    const arls = db.select({
      id: schema.arls.id,
      name: schema.arls.name,
      userId: schema.arls.userId,
      role: schema.arls.role,
      isActive: schema.arls.isActive,
      createdAt: schema.arls.createdAt,
    }).from(schema.arls).where(eq(schema.arls.tenantId, id)).all();

    const brands = db.select({ id: schema.brands.id, name: schema.brands.name, primaryColor: schema.brands.primaryColor })
      .from(schema.tenantBrands)
      .innerJoin(schema.brands, eq(schema.tenantBrands.brandId, schema.brands.id))
      .where(eq(schema.tenantBrands.tenantId, id))
      .all();

    const recentAudit = (getAuditLog(10, id) as Array<Record<string, unknown>>);

    return apiSuccess({
      tenant,
      stats: { locationCount, arlCount: arls.length },
      arls,
      brands,
      recentAudit,
    });
  } catch (error) {
    console.error("Tenant overview error:", error);
    return ApiErrors.internal();
  }
}
