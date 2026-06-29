import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// POST — "break glass" PIN reset for one specific ARL. Targets a single
// person (unlike force-logout), so it's a per-row action on the ARL list,
// not the tenant-wide Danger Zone. Closes the dead end where the only admin
// ARL in a tenant forgets their PIN and nobody inside that tenant can reset
// it. PIN re-confirmation required regardless of how recently the admin
// authenticated.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; arlId: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId, arlId } = await params;
    const { newPin, pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    if (!newPin || !/^\d{4}$/.test(newPin)) return ApiErrors.badRequest("New PIN must be exactly 4 digits");

    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    const arl = db.select({ id: schema.arls.id }).from(schema.arls)
      .where(and(eq(schema.arls.id, arlId), eq(schema.arls.tenantId, tenantId)))
      .get();
    if (!arl) return ApiErrors.notFound("ARL");

    db.update(schema.arls)
      .set({ pinHash: hashSync(newPin, 10), updatedAt: new Date().toISOString() })
      .where(eq(schema.arls.id, arlId))
      .run();

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "arl_pin_reset",
      entityType: "arl", tenantId, payload: { targetArlId: arlId }, status: "success",
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("ARL PIN reset error:", error);
    return ApiErrors.internal();
  }
}
