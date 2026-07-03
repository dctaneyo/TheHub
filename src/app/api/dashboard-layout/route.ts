import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { broadcastDashboardLayoutUpdate } from "@/lib/socket-emit";
import { parseJsonColumn } from "@/lib/json-column";
import { DEFAULT_LAYOUT } from "@/components/dashboard/grid/layouts";

// The dashboard grid layout is tenant-wide — every location and ARL under a
// tenant sees the same arrangement. There is no per-location or per-ARL
// override (see DESIGN.md's dashboard-customization decision, 2026-07-01).

// Returns the tenant's saved layout, or DEFAULT_LAYOUT if none has been set.
// Available to any authenticated session in the tenant (locations need this
// to render their dashboard, not just ARLs).
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const tenant = db
      .select({ gridLayout: tenants.gridLayout })
      .from(tenants)
      .where(eq(tenants.id, session.tenantId))
      .get();

    const layout = parseJsonColumn(tenant?.gridLayout, DEFAULT_LAYOUT);
    return apiSuccess({ layout });
  } catch (error) {
    console.error("Error fetching dashboard layout:", error);
    return ApiErrors.internal();
  }
}

// Persists (or clears, via layout: null → resets to DEFAULT_LAYOUT) the
// tenant's shared layout. Admin/superadmin ARLs only — same gate as tenant
// settings (src/app/api/tenants/settings/route.ts).
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    if (session.userType !== "arl" || (session.role !== "admin" && session.role !== "superadmin")) {
      return ApiErrors.forbidden("Only tenant admins can edit the dashboard layout");
    }

    const body = await req.json();
    const layout = body?.layout ?? null;

    if (layout !== null) {
      if (
        typeof layout !== "object" ||
        !Array.isArray((layout as { widgets?: unknown }).widgets)
      ) {
        return ApiErrors.badRequest("Invalid layout payload");
      }
    }

    const serialized = layout === null ? null : JSON.stringify(layout);
    if (serialized && serialized.length > 20_000) {
      return ApiErrors.badRequest("Layout payload too large");
    }

    db.update(tenants)
      .set({ gridLayout: serialized, updatedAt: new Date().toISOString() })
      .where(eq(tenants.id, session.tenantId))
      .run();

    broadcastDashboardLayoutUpdate(session.tenantId, layout ?? DEFAULT_LAYOUT);

    return apiSuccess({ ok: true });
  } catch (error) {
    console.error("Error saving dashboard layout:", error);
    return ApiErrors.internal();
  }
}
