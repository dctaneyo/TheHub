import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit-logger";

export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const brands = db.select().from(schema.brands).all();
    const withCounts = brands.map((b) => {
      const tenantCount = db.select({ id: schema.tenantBrands.id }).from(schema.tenantBrands).where(eq(schema.tenantBrands.brandId, b.id)).all().length;
      const taskTemplateCount = db.select({ id: schema.brandTaskTemplates.id }).from(schema.brandTaskTemplates).where(eq(schema.brandTaskTemplates.brandId, b.id)).all().length;
      return { ...b, tenantCount, taskTemplateCount };
    });
    return apiSuccess({ brands: withCounts });
  } catch (error) {
    console.error("List brands error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { name, logoUrl, primaryColor } = await req.json();
    if (!name) return ApiErrors.badRequest("name is required");

    const id = uuid();
    const now = new Date().toISOString();
    db.insert(schema.brands).values({ id, name, logoUrl: logoUrl || null, primaryColor: primaryColor || null, createdAt: now }).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "brand_created", entityType: "brand", payload: { brandId: id, name }, status: "success" });

    return apiSuccess({ id });
  } catch (error) {
    console.error("Create brand error:", error);
    return ApiErrors.internal();
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id, name, logoUrl, primaryColor } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;

    db.update(schema.brands).set(updates).where(eq(schema.brands.id, id)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "brand_updated", entityType: "brand", payload: { brandId: id, ...updates }, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Update brand error:", error);
    return ApiErrors.internal();
  }
}

// DELETE — hard delete (brands have no tenant data dependent on their
// continued existence beyond what's already been copied into tasks, which
// is independent once copied)
export async function DELETE(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");

    db.delete(schema.brandTaskTemplates).where(eq(schema.brandTaskTemplates.brandId, id)).run();
    db.delete(schema.tenantBrands).where(eq(schema.tenantBrands.brandId, id)).run();
    db.delete(schema.brands).where(eq(schema.brands.id, id)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "brand_deleted", entityType: "brand", payload: { brandId: id }, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete brand error:", error);
    return ApiErrors.internal();
  }
}
