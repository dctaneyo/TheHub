import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { locations, arls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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

    return NextResponse.json({ layout });
  } catch (error) {
    console.error("Error fetching layout preference:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { userType, userId } = payload;
    const body = await req.json();
    const { layout } = body;

    if (!layout || !["classic", "focus"].includes(layout)) {
      return NextResponse.json({ error: "Invalid layout value" }, { status: 400 });
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

    return NextResponse.json({ success: true, layout });
  } catch (error) {
    console.error("Error updating layout preference:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
