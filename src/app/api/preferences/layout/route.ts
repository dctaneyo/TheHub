import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { locations, arls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    let layout = "classic";
    if (session.userType === "location") {
      const loc = db.select({ dashboardLayout: locations.dashboardLayout }).from(locations).where(eq(locations.id, session.id)).get();
      if (loc?.dashboardLayout) layout = loc.dashboardLayout;
    } else if (session.userType === "arl") {
      const arl = db.select({ dashboardLayout: arls.dashboardLayout }).from(arls).where(eq(arls.id, session.id)).get();
      if (arl?.dashboardLayout) layout = arl.dashboardLayout;
    }

    return apiSuccess({ layout });
  } catch (error) {
    console.error("Error fetching layout preference:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { layout } = await req.json();
    if (!layout || !["classic", "focus"].includes(layout)) {
      return ApiErrors.badRequest("Invalid layout value");
    }

    if (session.userType === "location") {
      db.update(locations)
        .set({ dashboardLayout: layout, updatedAt: new Date().toISOString() })
        .where(eq(locations.id, session.id))
        .run();
    } else if (session.userType === "arl") {
      db.update(arls)
        .set({ dashboardLayout: layout, updatedAt: new Date().toISOString() })
        .where(eq(arls.id, session.id))
        .run();
    }

    return apiSuccess({ layout });
  } catch (error) {
    console.error("Error updating layout preference:", error);
    return ApiErrors.internal();
  }
}
