import { sqlite, db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// sessions.userId references either locations.id or arls.id, with no
// tenantId of its own — scope through whichever parent table user_type
// points at (same fragment as the relocated clear-sessions route).
const IN_TENANT = `(
  (user_type = 'location' AND user_id IN (SELECT id FROM locations WHERE tenant_id = ?))
  OR (user_type = 'arl' AND user_id IN (SELECT id FROM arls WHERE tenant_id = ?))
)`;

// POST — Danger Zone action: end every session in this tenant immediately.
// No "except current session" exception (unlike the ARL self-service
// version) — the admin isn't a tenant session. PIN re-confirmation required
// regardless of how recently the admin authenticated.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");

    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    const tenant = db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    if (!tenant) return ApiErrors.notFound("Tenant");

    const result = sqlite.prepare(`DELETE FROM sessions WHERE ${IN_TENANT}`).run(tenantId, tenantId);

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "force_logout",
      entityType: "tenant", tenantId, affectedCount: result.changes, status: "success",
    });

    return apiSuccess({ success: true, sessionsCleared: result.changes });
  } catch (error) {
    console.error("Force logout error:", error);
    return ApiErrors.internal();
  }
}
