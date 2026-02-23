import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// Public endpoint – no auth required. Returns only the display name (no PIN hash).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId || userId.length !== 4) {
      return NextResponse.json({ error: "Invalid User ID" }, { status: 400 });
    }

    const location = db.select().from(schema.locations).where(eq(schema.locations.userId, userId)).get();
    if (location) {
      if (!location.isActive) {
        return NextResponse.json({ error: "This location has been deactivated" }, { status: 403 });
      }
      return NextResponse.json({ found: true, userType: "location", name: location.name, storeNumber: location.storeNumber });
    }

    const arl = db.select().from(schema.arls).where(eq(schema.arls.userId, userId)).get();
    if (arl) {
      if (!arl.isActive) {
        return NextResponse.json({ error: "This account has been deactivated" }, { status: 403 });
      }
      return NextResponse.json({ found: true, userType: "arl", name: arl.name, role: arl.role });
    }

    return NextResponse.json({ error: "User ID not found" }, { status: 404 });
  } catch (error) {
    console.error("Validate user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
