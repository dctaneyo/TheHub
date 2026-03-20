import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST - Add a reaction to a broadcast
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { broadcastId, emoji, timestamp } = body;

    if (!broadcastId || !emoji) {
      return ApiErrors.badRequest("Missing required fields");
    }

    const reactionId = uuidv4();
    await db.insert(schema.broadcastReactions).values({
      id: reactionId,
      broadcastId,
      viewerType: session.userType,
      viewerId: session.userId,
      viewerName: session.name,
      emoji,
      timestamp: timestamp || 0,
      createdAt: new Date().toISOString(),
    });

    // Increment reaction count
    const broadcast = await db.select().from(schema.broadcasts)
      .where(eq(schema.broadcasts.id, broadcastId))
      .limit(1);

    if (broadcast.length > 0) {
      await db.update(schema.broadcasts)
        .set({ reactionCount: (broadcast[0].reactionCount || 0) + 1 })
        .where(eq(schema.broadcasts.id, broadcastId));
    }

    return apiSuccess({ reactionId });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return ApiErrors.internal("Failed to add reaction");
  }
}

// GET - Get reactions for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return ApiErrors.badRequest("Broadcast ID required");
    }

    const reactions = await db.select().from(schema.broadcastReactions)
      .where(eq(schema.broadcastReactions.broadcastId, broadcastId));

    return apiSuccess({ reactions });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return ApiErrors.internal("Failed to fetch reactions");
  }
}
