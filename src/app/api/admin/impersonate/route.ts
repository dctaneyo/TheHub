import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { signImpersonationToken, type AuthPayload } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit-logger";

const ROOT_ORIGIN = process.env.NODE_ENV === "production" ? "https://meetthehub.com" : "http://localhost:3000";

// POST — start impersonating a specific ARL. Support on an *existing* user
// (not provisioning — see the plan's feature-set rationale). Returns a
// hand-off URL that lands on the root domain (tenants resolve via the
// x-org-id cookie now, not a per-org subdomain) and sets both the
// impersonation session cookie and that cookie in one redirect.
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { arlId } = await req.json();
    if (!arlId) return ApiErrors.badRequest("arlId required");

    const arl = db.select().from(schema.arls).where(eq(schema.arls.id, arlId)).get();
    if (!arl) return ApiErrors.notFound("ARL");
    if (!arl.isActive) return ApiErrors.badRequest("This ARL account is deactivated");

    const tenant = db.select({ slug: schema.tenants.slug }).from(schema.tenants).where(eq(schema.tenants.id, arl.tenantId)).get();
    if (!tenant) return ApiErrors.notFound("Tenant");

    const payload: Omit<AuthPayload, "impersonatedBy" | "impersonationExpiresAt"> = {
      id: arl.id,
      tenantId: arl.tenantId,
      userType: "arl",
      userId: arl.userId,
      name: arl.name,
      role: arl.role,
    };

    const token = signImpersonationToken(payload, auth.session.adminId);

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "impersonate_start",
      entityType: "arl", tenantId: arl.tenantId,
      payload: { targetArlId: arl.id, targetArlName: arl.name, targetArlRole: arl.role }, status: "success",
    });

    const handoffUrl = `${ROOT_ORIGIN}/api/auth/force-apply?imp=1&token=${encodeURIComponent(token)}&org=${encodeURIComponent(tenant.slug)}&redirect=${encodeURIComponent("/arl")}`;

    return apiSuccess({ success: true, handoffUrl });
  } catch (error) {
    console.error("Impersonate start error:", error);
    return ApiErrors.internal();
  }
}
