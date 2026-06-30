import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit-logger";

// GET — list a brand's standard task templates
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: brandId } = await params;
    const templates = db.select().from(schema.brandTaskTemplates).where(eq(schema.brandTaskTemplates.brandId, brandId)).all();
    return apiSuccess({ templates });
  } catch (error) {
    console.error("List brand task templates error:", error);
    return ApiErrors.internal();
  }
}

// POST — add a standard task template to a brand
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: brandId } = await params;
    const body = await req.json();
    const { title, description, type, priority, dueTime, isRecurring, recurringType, recurringDays, biweeklyStart } = body;

    if (!title || !dueTime) return ApiErrors.badRequest("title and dueTime are required");

    const brand = db.select({ id: schema.brands.id }).from(schema.brands).where(eq(schema.brands.id, brandId)).get();
    if (!brand) return ApiErrors.notFound("Brand");

    const id = uuid();
    const now = new Date().toISOString();
    db.insert(schema.brandTaskTemplates).values({
      id, brandId, title, description: description || null,
      type: type || "task", priority: priority || "normal", dueTime,
      isRecurring: isRecurring ?? false, recurringType: recurringType || null,
      recurringDays: recurringDays || null, biweeklyStart: biweeklyStart || null,
      createdAt: now, updatedAt: now,
    }).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "brand_task_template_created", entityType: "brand", payload: { brandId, templateId: id, title }, status: "success" });

    return apiSuccess({ id });
  } catch (error) {
    console.error("Create brand task template error:", error);
    return ApiErrors.internal();
  }
}

// PUT — edit a standard task template
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: brandId } = await params;
    const body = await req.json();
    const { templateId, title, description, type, priority, dueTime, isRecurring, recurringType, recurringDays, biweeklyStart } = body;
    if (!templateId) return ApiErrors.badRequest("templateId required");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (priority !== undefined) updates.priority = priority;
    if (dueTime !== undefined) updates.dueTime = dueTime;
    if (isRecurring !== undefined) updates.isRecurring = isRecurring;
    if (recurringType !== undefined) updates.recurringType = recurringType;
    if (recurringDays !== undefined) updates.recurringDays = recurringDays;
    if (biweeklyStart !== undefined) updates.biweeklyStart = biweeklyStart;

    db.update(schema.brandTaskTemplates).set(updates).where(eq(schema.brandTaskTemplates.id, templateId)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "brand_task_template_updated", entityType: "brand", payload: { brandId, templateId }, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Update brand task template error:", error);
    return ApiErrors.internal();
  }
}

// DELETE — remove a standard task template (does not retroactively remove
// already-copied tasks from tenants — "copy once" means tenants own their
// copy from that point forward)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: brandId } = await params;
    const { templateId } = await req.json();
    if (!templateId) return ApiErrors.badRequest("templateId required");

    db.delete(schema.brandTaskTemplates).where(eq(schema.brandTaskTemplates.id, templateId)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "brand_task_template_deleted", entityType: "brand", payload: { brandId, templateId }, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete brand task template error:", error);
    return ApiErrors.internal();
  }
}
