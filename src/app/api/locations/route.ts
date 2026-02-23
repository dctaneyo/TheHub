import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema, sqlite } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";
import { broadcastUserUpdate } from "@/lib/socket-emit";

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

    // 3 minutes: heartbeat fires every 2 min, so 1 missed beat = stale
    const STALE_THRESHOLD_MS = 3 * 60 * 1000;
    const now = Date.now();
    const staleTimestamp = new Date(now - STALE_THRESHOLD_MS).toISOString();

    // Proactively mark stale sessions offline so they don't accumulate
    sqlite.prepare(
      `UPDATE sessions SET is_online = 0 WHERE is_online = 1 AND last_seen < ?`
    ).run(staleTimestamp);

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

      return {
        id: loc.id,
        name: loc.name,
        storeNumber: loc.storeNumber,
        address: loc.address,
        email: loc.email,
        userId: loc.userId,
        isActive: loc.isActive,
        soundMuted: loc.soundMuted ?? false,
        isOnline: latestSession != null,
        lastSeen: latestSession?.lastSeen || null,
        deviceType: latestSession?.deviceType || null,
        sessionCode: latestSession?.sessionCode || null,
        currentPage: latestSession?.currentPage || null,
        userKind: "location" as const,
      };
    });

    // Include ARLs online status (ARL-only)
    let arlsWithStatus: Array<{
      id: string; name: string; email: string | null; userId: string; role: string;
      isOnline: boolean; lastSeen: string | null; deviceType: string | null;
      sessionCode: string | null; currentPage: string | null; userKind: "arl";
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

        return {
          id: arl.id,
          name: arl.name,
          email: arl.email || null,
          userId: arl.userId,
          role: arl.role,
          isOnline: latestArlSession != null,
          lastSeen: latestArlSession?.lastSeen || null,
          deviceType: latestArlSession?.deviceType || null,
          sessionCode: latestArlSession?.sessionCode || null,
          currentPage: latestArlSession?.currentPage || null,
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
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
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

    broadcastUserUpdate();
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
    broadcastUserUpdate();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE permanently remove a location and all associated data
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // 1. Delete tasks assigned only to this location
    db.delete(schema.tasks).where(eq(schema.tasks.locationId, id)).run();

    // 2. Delete task completions for this location
    db.delete(schema.taskCompletions).where(eq(schema.taskCompletions.locationId, id)).run();

    // 3. Delete notifications
    db.delete(schema.notifications).where(eq(schema.notifications.locationId, id)).run();

    // 5. Delete sessions
    db.delete(schema.sessions).where(eq(schema.sessions.userId, id)).run();

    // 6. Find and delete direct conversations (1:1) involving this user
    const directConvos = db.select().from(schema.conversations).all().filter(
      (c) => c.type === "direct" && (c.participantAId === id || c.participantBId === id)
    );
    for (const conv of directConvos) {
      // Delete all messages in the direct conversation
      const msgIds = db.select({ id: schema.messages.id }).from(schema.messages)
        .where(eq(schema.messages.conversationId, conv.id)).all().map((m) => m.id);
      for (const msgId of msgIds) {
        db.delete(schema.messageReads).where(eq(schema.messageReads.messageId, msgId)).run();
      }
      db.delete(schema.messages).where(eq(schema.messages.conversationId, conv.id)).run();
      db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, conv.id)).run();
      db.delete(schema.conversations).where(eq(schema.conversations.id, conv.id)).run();
    }

    // 7. Delete this user's messages in group/global conversations
    const userMsgs = db.select({ id: schema.messages.id }).from(schema.messages)
      .where(eq(schema.messages.senderId, id)).all();
    for (const msg of userMsgs) {
      db.delete(schema.messageReads).where(eq(schema.messageReads.messageId, msg.id)).run();
    }
    db.delete(schema.messages).where(eq(schema.messages.senderId, id)).run();

    // 8. Delete read receipts by this user
    db.delete(schema.messageReads).where(eq(schema.messageReads.readerId, id)).run();

    // 9. Remove from remaining group conversation memberships
    db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.memberId, id)).run();

    // 10. Delete the location record
    db.delete(schema.locations).where(eq(schema.locations.id, id)).run();
    broadcastUserUpdate();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete location error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
