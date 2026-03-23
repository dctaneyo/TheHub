import { NextRequest } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { parseAssignedLocations } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
    const locationId = req.nextUrl.searchParams.get("locationId");

    if (![7, 14, 30].includes(days)) {
      return ApiErrors.badRequest("days must be 7, 14, or 30");
    }

    // Get ARL's assigned locations for scoping
    const arl = db
      .select({ role: schema.arls.role, assignedLocationIds: schema.arls.assignedLocationIds })
      .from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId)))
      .get();

    const assignedLocations = arl ? parseAssignedLocations(arl.assignedLocationIds) : null;

    // Calculate start date
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;

    let query = `
      SELECT 
        mc.date,
        mc.location_id as locationId,
        l.name as locationName,
        ROUND(AVG(mc.mood_score), 2) as avgMood,
        COUNT(*) as checkinCount
      FROM mood_checkins mc
      LEFT JOIN locations l ON l.id = mc.location_id
      WHERE mc.tenant_id = ?
        AND mc.date >= ?
    `;
    const params: (string | number)[] = [session.tenantId, startDateStr];

    // Scope to specific location if requested
    if (locationId) {
      query += ` AND mc.location_id = ?`;
      params.push(locationId);
    }

    // Scope to ARL's assigned locations
    if (assignedLocations && assignedLocations.length > 0) {
      const placeholders = assignedLocations.map(() => "?").join(",");
      query += ` AND mc.location_id IN (${placeholders})`;
      params.push(...assignedLocations);
    }

    query += ` GROUP BY mc.date, mc.location_id ORDER BY mc.date ASC`;

    const rows = sqlite.prepare(query).all(...params) as Array<{
      date: string;
      locationId: string;
      locationName: string;
      avgMood: number;
      checkinCount: number;
    }>;

    return apiSuccess({ data: rows });
  } catch (error) {
    console.error("GET /api/analytics/mood error:", error);
    return ApiErrors.internal();
  }
}
