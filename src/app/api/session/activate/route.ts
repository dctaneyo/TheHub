import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, getTokenExpiry, type AuthPayload } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastSessionActivated } from "@/lib/socket-emit";

function genSessionCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST - ARL activates a pending session by assigning it to a location or ARL account
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { pendingId, assignToType, assignToId } = await req.json();

    if (!pendingId || !assignToType || !assignToId) {
      return NextResponse.json({ error: "pendingId, assignToType, and assignToId are required" }, { status: 400 });
    }

    if (!["location", "arl"].includes(assignToType)) {
      return NextResponse.json({ error: "assignToType must be 'location' or 'arl'" }, { status: 400 });
    }

    // Find the pending session
    const pending = db
      .select()
      .from(schema.pendingSessions)
      .where(eq(schema.pendingSessions.id, pendingId))
      .get();

    if (!pending) {
      return NextResponse.json({ error: "Pending session not found" }, { status: 404 });
    }

    if (pending.status !== "pending") {
      return NextResponse.json({ error: "Session already activated" }, { status: 400 });
    }

    if (new Date(pending.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Pending session has expired" }, { status: 400 });
    }

    // Look up the target account
    let token: string;
    let redirectTo: string;
    let targetName: string;
    const sessionCode = genSessionCode();

    if (assignToType === "location") {
      const location = db.select().from(schema.locations).where(eq(schema.locations.id, assignToId)).get();
      if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
      if (!location.isActive) return NextResponse.json({ error: "Location is deactivated" }, { status: 403 });

      const payload: AuthPayload = {
        id: location.id,
        userType: "location",
        userId: location.userId,
        name: location.name,
        locationId: location.id,
        storeNumber: location.storeNumber,
        sessionCode,
      };
      token = signToken(payload);
      redirectTo = "/dashboard";
      targetName = location.name;

      // Create a real session record
      db.insert(schema.sessions).values({
        id: uuid(),
        sessionCode,
        userType: "location",
        userId: location.id,
        token,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceType: "kiosk",
        createdAt: new Date().toISOString(),
        expiresAt: getTokenExpiry(),
      }).run();
    } else {
      const arl = db.select().from(schema.arls).where(eq(schema.arls.id, assignToId)).get();
      if (!arl) return NextResponse.json({ error: "ARL not found" }, { status: 404 });
      if (!arl.isActive) return NextResponse.json({ error: "ARL account is deactivated" }, { status: 403 });

      const payload: AuthPayload = {
        id: arl.id,
        userType: "arl",
        userId: arl.userId,
        name: arl.name,
        role: arl.role,
        sessionCode,
      };
      token = signToken(payload);
      redirectTo = "/arl";
      targetName = arl.name;

      // Create a real session record
      db.insert(schema.sessions).values({
        id: uuid(),
        sessionCode,
        userType: "arl",
        userId: arl.id,
        token,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceType: "desktop",
        createdAt: new Date().toISOString(),
        expiresAt: getTokenExpiry(),
      }).run();
    }

    // Update the pending session with the activation info
    db.update(schema.pendingSessions)
      .set({
        status: "activated",
        assignedUserType: assignToType,
        assignedUserId: assignToId,
        activatedBy: session.id,
        token,
        redirectTo,
        activatedAt: new Date().toISOString(),
      })
      .where(eq(schema.pendingSessions.id, pendingId))
      .run();

    // Instantly notify login page watcher + ARLs
    broadcastSessionActivated(pendingId);

    return NextResponse.json({
      success: true,
      targetName,
      redirectTo,
    });
  } catch (error) {
    console.error("Activate session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
