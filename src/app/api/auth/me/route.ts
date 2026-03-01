import { NextResponse } from "next/server";
import { getAuthSession, unauthorized, getArlPermissions } from "@/lib/api-helpers";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    // For ARLs, include fresh role + permissions from DB
    if (session.userType === "arl") {
      const arlPerms = getArlPermissions(session.id, session.tenantId);
      const role = arlPerms?.role ?? session.role ?? "arl";
      const permissions = role === "admin" ? ALL_PERMISSIONS : (arlPerms?.permissions ?? ALL_PERMISSIONS);
      return NextResponse.json({
        user: { ...session, role, permissions },
      });
    }

    return NextResponse.json({ user: session });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
