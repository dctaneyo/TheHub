import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Moved from /api/data-management/purge-notifications — admin-session-gated
// only, plus PIN re-confirmation since this is irreversible.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    let deletedNotifications = 0;
    let deletedEmergency = 0;

    try { deletedNotifications = sqlite.prepare("DELETE FROM notifications WHERE tenant_id = ?").run(tenantId).changes; } catch (e) { console.error("Purge notifications error:", e); }
    try { deletedEmergency = sqlite.prepare("DELETE FROM emergency_messages WHERE tenant_id = ?").run(tenantId).changes; } catch (e) { console.error("Purge emergency_messages error:", e); }

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "purge", entityType: "notifications", affectedCount: deletedNotifications + deletedEmergency, payload: { deletedNotifications, deletedEmergency }, status: "success" });

    return apiSuccess({
      deletedNotifications,
      deletedEmergency,
    });
  } catch (error) {
    console.error("Purge notifications error:", error);
    return ApiErrors.internal();
  }
}
