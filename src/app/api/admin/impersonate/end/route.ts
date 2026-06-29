import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ApiErrors } from "@/lib/api-response";
import { logAudit } from "@/lib/audit-logger";

// POST — end an impersonation session. Called with the impersonated ARL
// session (not the admin session) — only a session carrying
// impersonatedBy can call this. The impersonate_end audit row is written
// BEFORE the cookie is cleared, not after — clearing first loses the actor
// context needed for the audit entry.
export async function POST() {
  const session = await getSession();
  if (!session || !session.impersonatedBy) {
    return ApiErrors.forbidden("Not an impersonation session");
  }

  logAudit({
    userId: session.impersonatedBy, userType: "platform_admin", operation: "impersonate_end",
    entityType: "arl", tenantId: session.tenantId,
    payload: { targetArlId: session.id, targetArlName: session.name, targetArlRole: session.role },
    status: "success",
  });

  const response = NextResponse.json({ ok: true, success: true });
  response.cookies.set("hub-token", "", { maxAge: 0, path: "/" });
  return response;
}
