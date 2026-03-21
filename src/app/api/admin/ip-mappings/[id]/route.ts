import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { ApiErrors, apiSuccess } from "@/lib/api-response";

// DELETE /api/admin/ip-mappings/[id] — remove a mapping
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session) return ApiErrors.unauthorized();
  if (session.userType !== "arl") return ApiErrors.forbidden("ARL or admin access required");

  // Verify ARL exists in DB
  const arl = db
    .select({ role: schema.arls.role })
    .from(schema.arls)
    .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId)))
    .get();

  if (!arl) return ApiErrors.forbidden("ARL not found");

  try {
    const { id } = await params;

    if (!id) return ApiErrors.badRequest("Mapping ID is required");

    // Verify the mapping exists and belongs to the current tenant
    const mapping = db
      .select({ id: schema.orgIpMappings.id, tenantId: schema.orgIpMappings.tenantId })
      .from(schema.orgIpMappings)
      .where(eq(schema.orgIpMappings.id, id))
      .get();

    if (!mapping) {
      return ApiErrors.notFound("IP mapping");
    }

    if (mapping.tenantId !== session.tenantId) {
      return ApiErrors.forbidden("Cannot delete mappings from another tenant");
    }

    db.delete(schema.orgIpMappings)
      .where(eq(schema.orgIpMappings.id, id))
      .run();

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete IP mapping error:", error);
    return ApiErrors.internal();
  }
}
