import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { locations, arls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return ApiErrors.unauthorized();
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return ApiErrors.unauthorized();
    }

    const { userType, userId } = payload;

    let layout = "classic";
    if (userType === "location") {
      const [location] = await db.select().from(locations).where(eq(locations.id, userId));
      if (location) {
        layout = location.dashboardLayout || "classic";
      }
    } else if (userType === "arl") {
      const [arl] = await db.select().from(arls).where(eq(arls.id, userId));
      if (arl) {
        layout = arl.dashboardLayout || "classic";
      }
    }

    return apiSuccess({ layout });
  } catch (error) {
    console.error("Error fetching layout preference:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return ApiErrors.unauthorized();
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return ApiErrors.unauthorized();
    }

    const { userType, userId } = payload;
    const body = await req.json();
    const { layout } = body;

    if (!layout || !["classic", "focus"].includes(layout)) {
      return ApiErrors.badRequest("Invalid layout value");
    }

    if (userType === "location") {
      await db.update(locations)
        .set({ dashboardLayout: layout, updatedAt: new Date().toISOString() })
        .where(eq(locations.id, userId));
    } else if (userType === "arl") {
      await db.update(arls)
        .set({ dashboardLayout: layout, updatedAt: new Date().toISOString() })
        .where(eq(arls.id, userId));
    }

    return apiSuccess({ success: true, layout });
  } catch (error) {
    console.error("Error updating layout preference:", error);
    return ApiErrors.internal();
  }
}
