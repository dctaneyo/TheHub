import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";

// GET all locations (+ ARLs) with session status
export async function GET() {
  try {
    const session = await getSession();
    // Locations can also call this for their own data (tasks, forms)
    // but full list with ARL data is ARL-only
    const isArl = session?.userType === "arl";
    const isLocation = session?.userType === "location";
    if (!session || (!isArl && !isLocation)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const allLocations = db.select().from(schema.locations).all();

    const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    const locationsWithStatus = allLocations.map((loc) => {
      const latestSession = db
        .select()
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.userId, loc.id),
            eq(schema.sessions.userType, "location"),
            eq(schema.sessions.isOnline, true)
          )
        )
        .orderBy(desc(schema.sessions.lastSeen))
        .limit(1)
        .get();

      const isStale = latestSession?.lastSeen
        ? now - new Date(latestSession.lastSeen).getTime() > STALE_THRESHOLD_MS
        : true;

      return {
        id: loc.id,
        name: loc.name,
        storeNumber: loc.storeNumber,
        address: loc.address,
        email: loc.email,
        userId: loc.userId,
        isActive: loc.isActive,
        isOnline: latestSession?.isOnline && !isStale ? true : false,
        lastSeen: latestSession?.lastSeen || null,
        deviceType: latestSession?.deviceType || null,
        sessionCode: latestSession?.sessionCode || null,
        userKind: "location" as const,
      };
    });

    // Include ARLs online status (ARL-only)
    let arlsWithStatus: Array<{
      id: string; name: string; userId: string; role: string;
      isOnline: boolean; lastSeen: string | null; deviceType: string | null;
      sessionCode: string | null; userKind: "arl";
    }> = [];

    if (isArl) {
      const allArls = db.select().from(schema.arls).all();
      arlsWithStatus = allArls.map((arl) => {
        const latestArlSession = db
          .select()
          .from(schema.sessions)
          .where(
            and(
              eq(schema.sessions.userId, arl.id),
              eq(schema.sessions.userType, "arl"),
              eq(schema.sessions.isOnline, true)
            )
          )
          .orderBy(desc(schema.sessions.lastSeen))
          .limit(1)
          .get();

        const isArlStale = latestArlSession?.lastSeen
          ? now - new Date(latestArlSession.lastSeen).getTime() > STALE_THRESHOLD_MS
          : true;

        return {
          id: arl.id,
          name: arl.name,
          userId: arl.userId,
          role: arl.role,
          isOnline: latestArlSession?.isOnline && !isArlStale ? true : false,
          lastSeen: latestArlSession?.lastSeen || null,
          deviceType: latestArlSession?.deviceType || null,
          sessionCode: latestArlSession?.sessionCode || null,
          userKind: "arl" as const,
        };
      });
    }

    return NextResponse.json({ locations: locationsWithStatus, arls: arlsWithStatus });
  } catch (error) {
    console.error("Get locations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create new location (ARL admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl" || session.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { name, storeNumber, address, email, userId, pin } = await req.json();

    if (!name || !storeNumber || !userId || !pin) {
      return NextResponse.json(
        { error: "Name, store number, user ID, and PIN are required" },
        { status: 400 }
      );
    }

    if (userId.length !== 6 || pin.length !== 6) {
      return NextResponse.json(
        { error: "User ID and PIN must be 6 digits" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const location = {
      id: uuid(),
      name,
      storeNumber,
      address: address || null,
      email: email || null,
      userId,
      pinHash: hashSync(pin, 10),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.locations).values(location).run();

    // Create a direct conversation between this location and each ARL
    const arls = db.select().from(schema.arls).all();
    for (const arl of arls) {
      const convId = uuid();
      db.insert(schema.conversations).values({
        id: convId,
        type: "direct",
        participantAId: arl.id,
        participantAType: "arl",
        participantBId: location.id,
        participantBType: "location",
        createdAt: now,
      }).run();
      db.insert(schema.conversationMembers).values([
        { id: uuid(), conversationId: convId, memberId: arl.id, memberType: "arl", joinedAt: now },
        { id: uuid(), conversationId: convId, memberId: location.id, memberType: "location", joinedAt: now },
      ]).run();
    }
    // Add to global chat if it exists
    const globalConv = db.select().from(schema.conversations).where(eq(schema.conversations.type, "global")).get();
    if (globalConv) {
      db.insert(schema.conversationMembers).values({
        id: uuid(), conversationId: globalConv.id, memberId: location.id, memberType: "location", joinedAt: now,
      }).run();
    }

    return NextResponse.json({ success: true, location: { ...location, pinHash: undefined } });
  } catch (error) {
    console.error("Create location error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT update location
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const { id, name, email, pin, address, isActive } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (isActive !== undefined) updates.isActive = isActive;
    if (pin && pin.length === 6) updates.pinHash = hashSync(pin, 10);

    db.update(schema.locations).set(updates).where(eq(schema.locations.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
