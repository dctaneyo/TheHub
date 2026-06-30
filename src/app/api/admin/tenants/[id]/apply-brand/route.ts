import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit-logger";

// DELETE — remove a brand association from a tenant. Does NOT remove tasks
// that were already copied in (those belong to the tenant now), only removes
// the tenantBrands join row so the brand no longer shows as a tag.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { brandId } = await req.json();
    if (!brandId) return ApiErrors.badRequest("brandId required");

    db.delete(schema.tenantBrands)
      .where(and(eq(schema.tenantBrands.tenantId, tenantId), eq(schema.tenantBrands.brandId, brandId)))
      .run();

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "brand_removed",
      entityType: "tenant", tenantId, payload: { brandId }, status: "success",
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Remove brand error:", error);
    return ApiErrors.internal();
  }
}

// POST — apply a brand's standard tasks to an existing tenant. One-time
// copy-in, idempotent via sourceBrandTaskId (re-applying skips templates
// already copied). Available at tenant creation too (tenant-provisioning.ts),
// this is the "apply it again later" path.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { brandId } = await req.json();
    if (!brandId) return ApiErrors.badRequest("brandId required");

    const tenant = db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    if (!tenant) return ApiErrors.notFound("Tenant");

    const brand = db.select().from(schema.brands).where(eq(schema.brands.id, brandId)).get();
    if (!brand) return ApiErrors.notFound("Brand");

    const now = new Date().toISOString();

    const existingAssociation = db.select({ id: schema.tenantBrands.id })
      .from(schema.tenantBrands)
      .where(and(eq(schema.tenantBrands.tenantId, tenantId), eq(schema.tenantBrands.brandId, brandId)))
      .get();
    if (!existingAssociation) {
      db.insert(schema.tenantBrands).values({ id: uuid(), tenantId, brandId, createdAt: now }).run();
    }

    const templates = db.select().from(schema.brandTaskTemplates).where(eq(schema.brandTaskTemplates.brandId, brandId)).all();

    const existingCopies = db.select({ sourceBrandTaskId: schema.tasks.sourceBrandTaskId })
      .from(schema.tasks)
      .where(eq(schema.tasks.tenantId, tenantId))
      .all();
    const alreadyCopied = new Set(existingCopies.map((t) => t.sourceBrandTaskId).filter(Boolean));

    let copiedCount = 0;
    for (const template of templates) {
      if (alreadyCopied.has(template.id)) continue; // idempotent — skip templates already applied
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
        createdBy: auth.session.adminId,
        createdByType: "brand",
        sourceBrandTaskId: template.id,
        createdAt: now,
        updatedAt: now,
      }).run();
      copiedCount++;
    }

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "brand_applied",
      entityType: "tenant", tenantId, payload: { brandId, copiedCount }, status: "success",
    });

    return apiSuccess({ success: true, copiedCount });
  } catch (error) {
    console.error("Apply brand error:", error);
    return ApiErrors.internal();
  }
}
