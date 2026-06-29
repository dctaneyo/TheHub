import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// sessions.userId references either locations.id or arls.id, with no
// tenantId of its own — scope through whichever parent table user_type
// points at.
const IN_TENANT = `(
  (user_type = 'location' AND user_id IN (SELECT id FROM locations WHERE tenant_id = ?))
  OR (user_type = 'arl' AND user_id IN (SELECT id FROM arls WHERE tenant_id = ?))
)`;

// Moved from /api/data-management/clear-sessions — admin-session-gated
// only, plus PIN re-confirmation. No "except current session" exception on
// force-all (unlike the original ARL self-service version) — the admin
// triggering this isn't a session inside the tenant. For the simpler,
// Danger-Zone version of force-all alone, see
// /api/admin/tenants/[id]/force-logout.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id: tenantId } = await params;
    const { mode, pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    let deleted = 0;

    if (mode === "stale") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const r = sqlite.prepare(
        `DELETE FROM sessions WHERE is_online = 0 AND last_seen < ? AND ${IN_TENANT}`
      ).run(sevenDaysAgo.toISOString(), tenantId, tenantId);
      deleted = r.changes;
    } else if (mode === "all-offline") {
      const r = sqlite.prepare(`DELETE FROM sessions WHERE is_online = 0 AND ${IN_TENANT}`).run(tenantId, tenantId);
      deleted = r.changes;
    } else if (mode === "force-all") {
      const r = sqlite.prepare(`DELETE FROM sessions WHERE ${IN_TENANT}`).run(tenantId, tenantId);
      deleted = r.changes;
    } else {
      return ApiErrors.badRequest("Invalid mode");
    }

    logAudit({ tenantId, userId: auth.session.adminId, userType: "platform_admin", operation: "clear_sessions", entityType: "sessions", affectedCount: deleted, payload: { mode }, status: "success" });

    return apiSuccess({ deleted, mode });
  } catch (error) {
    console.error("Clear sessions error:", error);
    return ApiErrors.internal();
  }
}
