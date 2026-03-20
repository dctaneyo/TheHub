import { NextResponse } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { broadcastToAll } from "@/lib/socket-emit";
import { sendPushToAllARLs } from "@/lib/push";
import { createNotification } from "@/lib/notifications";

// Ensure shoutouts table exists
function ensureShoutoutsTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS shoutouts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'kazi',
        from_user_id TEXT NOT NULL,
        from_user_type TEXT NOT NULL,
        from_user_name TEXT NOT NULL,
        to_location_id TEXT NOT NULL,
        to_location_name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reactions TEXT DEFAULT '[]'
      )
    `);
    try { sqlite.exec(`ALTER TABLE shoutouts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'kazi'`); } catch (e) {
      // Column may already exist
    }
  } catch (e) {
    console.error("Failed to ensure shoutouts table:", e);
  }
}

// GET - Fetch recent shoutouts
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    ensureShoutoutsTable();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const locationId = searchParams.get("locationId");

    let query = "SELECT * FROM shoutouts WHERE tenant_id = ?";
    let params: any[] = [session.tenantId];

    if (locationId) {
      query += " AND to_location_id = ?";
      params.push(locationId);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const shoutouts = sqlite.prepare(query).all(...params) as any[];

    // Parse reactions JSON
    const parsed = shoutouts.map(s => ({
      ...s,
      reactions: JSON.parse(s.reactions || '[]'),
    }));

    return apiSuccess({ shoutouts: parsed });
  } catch (error) {
    console.error("Get shoutouts error:", error);
    return ApiErrors.internal();
  }
}

// POST - Create a new shoutout
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    if (session.userType === "arl") {
      const denied = await requirePermission(session, PERMISSIONS.GAMIFICATION_SEND);
      if (denied) return denied;
    }

    const { toLocationId, toLocationName, message } = await request.json();

    if (!toLocationId || !message) {
      return ApiErrors.badRequest("Missing required fields");
    }

    ensureShoutoutsTable();

    const shoutoutId = uuid();
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO shoutouts (
        id, tenant_id, from_user_id, from_user_type, from_user_name,
        to_location_id, to_location_name, message, created_at, reactions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
    `).run(
      shoutoutId,
      session.tenantId,
      session.id,
      session.userType,
      session.name,
      toLocationId,
      toLocationName,
      message,
      now
    );

    const shoutout = {
      id: shoutoutId,
      from_user_id: session.id,
      from_user_type: session.userType,
      from_user_name: session.name,
      to_location_id: toLocationId,
      to_location_name: toLocationName,
      message,
      created_at: now,
      reactions: [],
    };

    // Broadcast to all users
    broadcastToAll("shoutout:new", shoutout);

    // Push notification to all ARLs about the shoutout
    await sendPushToAllARLs({
      title: `Shoutout to ${toLocationName}! 🎉`,
      body: `${session.name}: ${message.slice(0, 100)}`,
      url: `/arl`,
    });

    // Create in-app notification for the location receiving the shoutout
    await createNotification({
      userId: toLocationId,
      userType: "location",
      type: "new_shoutout",
      title: `You received a shoutout! 🎉`,
      message: `${session.name}: ${message}`,
      actionUrl: "/dashboard",
      actionLabel: "View",
      priority: "normal",
      metadata: {
        shoutoutId,
        fromUserId: session.id,
        fromUserName: session.name,
      },
    });

    return apiSuccess({ shoutout });
  } catch (error) {
    console.error("Create shoutout error:", error);
    return ApiErrors.internal();
  }
}

// PATCH - Add reaction to shoutout
export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { shoutoutId, emoji } = await request.json();

    if (!shoutoutId || !emoji) {
      return ApiErrors.badRequest("Missing required fields");
    }

    ensureShoutoutsTable();

    const shoutout = sqlite.prepare("SELECT * FROM shoutouts WHERE id = ?").get(shoutoutId) as any;

    if (!shoutout) {
      return ApiErrors.notFound("Shoutout");
    }

    const reactions = JSON.parse(shoutout.reactions || '[]');
    
    // Add reaction
    reactions.push({
      userId: session.id,
      userName: session.name,
      emoji,
      timestamp: new Date().toISOString(),
    });

    sqlite.prepare("UPDATE shoutouts SET reactions = ? WHERE id = ?")
      .run(JSON.stringify(reactions), shoutoutId);

    // Broadcast update
    broadcastToAll("shoutout:reaction", { shoutoutId, reactions });

    return apiSuccess({ reactions });
  } catch (error) {
    console.error("React to shoutout error:", error);
    return ApiErrors.internal();
  }
}

// DELETE - Purge all shoutouts (ARL only)
export async function DELETE() {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }

    ensureShoutoutsTable();
    sqlite.prepare("DELETE FROM shoutouts WHERE tenant_id = ?").run(session.tenantId);

    broadcastToAll("shoutout:purged", {});

    return apiSuccess({ purged: true });
  } catch (error) {
    console.error("Purge shoutouts error:", error);
    return ApiErrors.internal();
  }
}
