import { getAuthSession, getArlPermissions } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    // For ARLs, include fresh role + permissions + location assignments from DB
    if (session.userType === "arl") {
      const arlPerms = getArlPermissions(session.id, session.tenantId);
      const role = arlPerms?.role ?? session.role ?? "arl";
      const permissions = role === "admin" ? ALL_PERMISSIONS : (arlPerms?.permissions ?? ALL_PERMISSIONS);
      const roleId = arlPerms?.roleId ?? null;
      const assignedLocationIds = role === "admin" ? null : (arlPerms?.assignedLocationIds ?? null);
      return apiSuccess({
        user: { ...session, role, roleId, permissions, assignedLocationIds },
      });
    }

    return apiSuccess({ user: session });
  } catch {
    return ApiErrors.internal();
  }
}
