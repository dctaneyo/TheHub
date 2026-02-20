import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, getTokenExpiry, type AuthPayload } from "@/lib/auth";
import { db, schema, sqlite } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastForceLogout, broadcastForceRedirect, broadcastPresenceUpdate } from "@/lib/socket-emit";
import { setPendingForceAction } from "@/lib/socket-server";

function genSessionCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// GET - list all active sessions (for ARL management UI)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Mark stale sessions offline before listing (same threshold as locations route)
    const STALE_MS = 3 * 60 * 1000;
    const staleTimestamp = new Date(Date.now() - STALE_MS).toISOString();
    sqlite.prepare(
      `UPDATE sessions SET is_online = 0 WHERE is_online = 1 AND last_seen < ?`
    ).run(staleTimestamp);

    const activeSessions = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.isOnline, true))
      .orderBy(desc(schema.sessions.lastSeen))
      .all();

    // Enrich with user names
    const enriched = activeSessions.map((s) => {
      let name = "Unknown";
      let storeNumber: string | null = null;
      if (s.userType === "location") {
        const loc = db.select().from(schema.locations).where(eq(schema.locations.id, s.userId)).get();
        if (loc) { name = loc.name; storeNumber = loc.storeNumber; }
      } else {
        const arl = db.select().from(schema.arls).where(eq(schema.arls.id, s.userId)).get();
        if (arl) { name = arl.name; }
      }
      return {
        id: s.id,
        sessionCode: s.sessionCode,
        userType: s.userType,
        userId: s.userId,
        name,
        storeNumber,
        deviceType: s.deviceType,
        lastSeen: s.lastSeen,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json({ activeSessions: enriched });
  } catch (error) {
    console.error("Get active sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - force logout or reassign an active session
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { action, sessionId, assignToType, assignToId } = await req.json();

    if (!action || !sessionId) {
      return NextResponse.json({ error: "action and sessionId are required" }, { status: 400 });
    }

    // Find the active session
    const targetSession = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();

    if (!targetSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // ── FORCE LOGOUT ──
    if (action === "logout") {
      // Store pending force action so heartbeat fallback can detect it
      if (targetSession.token) {
        setPendingForceAction(targetSession.token, { action: "logout" });
      }

      // Delete the session record so heartbeat can't revive it
      db.delete(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .run();

      // Emit socket event to force client redirect to login (primary / instant)
      broadcastForceLogout(targetSession.userId, targetSession.userType);
      broadcastPresenceUpdate(targetSession.userId, targetSession.userType, "", false);

      return NextResponse.json({ success: true, action: "logout" });
    }

    // ── FORCE REASSIGN ──
    if (action === "reassign") {
      if (!assignToType || !assignToId) {
        return NextResponse.json({ error: "assignToType and assignToId required for reassign" }, { status: 400 });
      }
      if (!["location", "arl"].includes(assignToType)) {
        return NextResponse.json({ error: "assignToType must be 'location' or 'arl'" }, { status: 400 });
      }

      // Create new token + session for the target account
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
      }

      // Store pending force action so heartbeat fallback can detect it
      if (targetSession.token) {
        setPendingForceAction(targetSession.token, { action: "redirect", token, redirectTo });
      }

      // Delete old session so heartbeat can't revive it
      db.delete(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .run();

      // Create new session record
      db.insert(schema.sessions).values({
        id: uuid(),
        sessionCode,
        userType: assignToType,
        userId: assignToId,
        token,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceType: targetSession.deviceType || "kiosk",
        createdAt: new Date().toISOString(),
        expiresAt: getTokenExpiry(),
      }).run();

      // Emit socket event to force client to apply new token and redirect
      broadcastForceRedirect(targetSession.userId, targetSession.userType, token, redirectTo);
      broadcastPresenceUpdate(targetSession.userId, targetSession.userType, "", false);

      return NextResponse.json({ success: true, action: "reassign", targetName, redirectTo });
    }

    return NextResponse.json({ error: "action must be 'logout' or 'reassign'" }, { status: 400 });
  } catch (error) {
    console.error("Force session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
