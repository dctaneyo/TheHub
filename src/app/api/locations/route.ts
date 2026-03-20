import { NextRequest } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema, sqlite } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";
import { broadcastUserUpdate } from "@/lib/socket-emit";
import { validate, createLocationSchema, updateLocationSchema } from "@/lib/validations";
import { getTenant, canAddLocation } from "@/lib/tenant";
import { logAudit } from "@/lib/audit-logger";

// GET all locations (+ ARLs) with session status
export async function GET() {
  try {
    const session = await getAuthSession();
    const isArl = session?.userType === "arl";
    const isLocation = session?.userType === "location";
    if (!session || (!isArl && !isLocation)) {
      return ApiErrors.forbidden();
    }

    const allLocations = db.select().from(schema.locations).where(eq(schema.locations.tenantId, session.tenantId)).all();

    // 3 minutes: heartbeat fires every 2 min, so 1 missed beat = stale
    const STALE_THRESHOLD_MS = 3 * 60 * 1000;
    const now = Date.now();
    const staleTimestamp = new Date(now - STALE_THRESHOLD_MS).toISOString();

    // Proactively mark stale sessions offline so they don't accumulate
    sqlite.prepare(
      `UPDATE sessions SET is_online = 0 WHERE is_online = 1 AND last_seen < ?`
    ).run(staleTimestamp);

    // Batch-fetch all online sessions once (avoids N+1 per-location/ARL lookups)
    const onlineSessions = db.select().from(schema.sessions)
      .where(eq(schema.sessions.isOnline, true))
      .orderBy(desc(schema.sessions.lastSeen))
      .all();
    // Build a map: userId → latest session (first match since ordered by lastSeen DESC)
    const sessionMap = new Map<string, typeof onlineSessions[0]>();
    for (const s of onlineSessions) {
      if (!sessionMap.has(s.userId)) sessionMap.set(s.userId, s);
    }

    const locationsWithStatus = allLocations.map((loc) => {
      const latestSession = sessionMap.get(loc.id);

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
      const allArls = db.select().from(schema.arls).where(eq(schema.arls.tenantId, session.tenantId)).all();
      arlsWithStatus = allArls.map((arl) => {
        const latestArlSession = sessionMap.get(arl.id);

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

    return apiSuccess({ locations: locationsWithStatus, arls: arlsWithStatus });
  } catch (error) {
    console.error("Get locations error:", error);
    return ApiErrors.internal();
  }
}

// POST create new location (ARL with permission)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_CREATE);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(createLocationSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { name, storeNumber, address, email, userId, pin } = parsed.data;

    // Enforce tenant location limit
    const tenant = await getTenant();
    if (tenant && !canAddLocation(session.tenantId, tenant.maxLocations)) {
      return ApiErrors.forbidden(`Location limit reached (${tenant.maxLocations} max for your plan)`);
    }

    const now = new Date().toISOString();
    const location = {
      id: uuid(),
      tenantId: session.tenantId,
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
    const arls = db.select().from(schema.arls).where(eq(schema.arls.tenantId, session.tenantId)).all();
    for (const arl of arls) {
      const convId = uuid();
      db.insert(schema.conversations).values({
        id: convId,
        tenantId: session.tenantId,
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
    const globalConv = db.select().from(schema.conversations).where(and(eq(schema.conversations.type, "global"), eq(schema.conversations.tenantId, session.tenantId))).get();
    if (globalConv) {
      db.insert(schema.conversationMembers).values({
        id: uuid(), conversationId: globalConv.id, memberId: location.id, memberType: "location", joinedAt: now,
      }).run();
    }

    broadcastUserUpdate(session.tenantId);
    logAudit({ tenantId: session.tenantId, userId: session.id, userType: "arl", operation: "create", entityType: "location", payload: { targetId: location.id, name, storeNumber }, status: "success" });
    return apiSuccess({ location: { ...location, pinHash: undefined } });
  } catch (error) {
    console.error("Create location error:", error);
    return ApiErrors.internal();
  }
}

// PUT update location
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden();
    }
    const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_EDIT);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(updateLocationSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { id, name, email, pin, address, isActive } = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (isActive !== undefined) updates.isActive = isActive;
    if (pin && pin.length === 4) updates.pinHash = hashSync(pin, 10);

    db.update(schema.locations).set(updates).where(and(eq(schema.locations.id, id), eq(schema.locations.tenantId, session.tenantId))).run();
    broadcastUserUpdate(session.tenantId);
    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Update location error:", error);
    return ApiErrors.internal();
  }
}

// DELETE permanently remove a location and all associated data
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_DELETE);
    if (denied) return denied;
    const { id } = await req.json();
    if (!id) return ApiErrors.badRequest("id required");

    // 1. Delete tasks assigned only to this location
    db.delete(schema.tasks).where(eq(schema.tasks.locationId, id)).run();

    // 2. Delete task completions for this location
    db.delete(schema.taskCompletions).where(eq(schema.taskCompletions.locationId, id)).run();

    // 3. Delete notifications
    db.delete(schema.notifications).where(eq(schema.notifications.userId, id)).run();

    // 5. Delete sessions
    db.delete(schema.sessions).where(eq(schema.sessions.userId, id)).run();

    // 6. Find and delete direct conversations (1:1) involving this user — batch SQL
    // Delete reads for messages in direct conversations
    sqlite.prepare(`
      DELETE FROM message_reads WHERE message_id IN (
        SELECT m.id FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.type = 'direct' AND (c.participant_a_id = ? OR c.participant_b_id = ?)
      )
    `).run(id, id);
    // Delete messages in direct conversations
    sqlite.prepare(`
      DELETE FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE type = 'direct' AND (participant_a_id = ? OR participant_b_id = ?)
      )
    `).run(id, id);
    // Delete members of direct conversations
    sqlite.prepare(`
      DELETE FROM conversation_members WHERE conversation_id IN (
        SELECT id FROM conversations WHERE type = 'direct' AND (participant_a_id = ? OR participant_b_id = ?)
      )
    `).run(id, id);
    // Delete the direct conversations themselves
    sqlite.prepare(`
      DELETE FROM conversations WHERE type = 'direct' AND (participant_a_id = ? OR participant_b_id = ?)
    `).run(id, id);

    // 7. Delete reads for this user's messages in group/global conversations, then the messages
    sqlite.prepare(`
      DELETE FROM message_reads WHERE message_id IN (
        SELECT id FROM messages WHERE sender_id = ?
      )
    `).run(id);
    db.delete(schema.messages).where(eq(schema.messages.senderId, id)).run();

    // 8. Delete read receipts by this user
    db.delete(schema.messageReads).where(eq(schema.messageReads.readerId, id)).run();

    // 9. Remove from remaining group conversation memberships
    db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.memberId, id)).run();

    // 10. Delete the location record
    const targetLoc = db.select({ name: schema.locations.name }).from(schema.locations).where(and(eq(schema.locations.id, id), eq(schema.locations.tenantId, session.tenantId))).get();
    db.delete(schema.locations).where(eq(schema.locations.id, id)).run();
    broadcastUserUpdate(session.tenantId);
    logAudit({ tenantId: session.tenantId, userId: session.id, userType: "arl", operation: "delete", entityType: "location", payload: { targetId: id, targetName: targetLoc?.name }, status: "success" });
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Delete location error:", error);
    return ApiErrors.internal();
  }
}
