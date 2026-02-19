import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// POST - ARL forces a session code onto a location's active session
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { locationId, sessionCode } = await req.json();
    if (!locationId || !sessionCode) {
      return NextResponse.json({ error: "locationId and sessionCode are required" }, { status: 400 });
    }

    // Validate session code format (6 digits)
    if (!/^\d{6}$/.test(sessionCode)) {
      return NextResponse.json({ error: "Session code must be 6 digits" }, { status: 400 });
    }

    // Find the location
    const location = db.select().from(schema.locations).where(eq(schema.locations.id, locationId)).get();
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Update all active sessions for this location with the new code
    const sessions = db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, locationId),
          eq(schema.sessions.isOnline, true)
        )
      )
      .all();

    if (sessions.length === 0) {
      return NextResponse.json({ error: "No active sessions found for this location" }, { status: 404 });
    }

    for (const s of sessions) {
      db.update(schema.sessions)
        .set({ sessionCode })
        .where(eq(schema.sessions.id, s.id))
        .run();
    }

    return NextResponse.json({
      success: true,
      locationName: location.name,
      sessionCode,
      sessionsUpdated: sessions.length,
    });
  } catch (error) {
    console.error("Force session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
