import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// POST - Add a reaction to a broadcast
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { broadcastId, emoji, timestamp } = body;

    if (!broadcastId || !emoji) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    return NextResponse.json({ reactionId });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 });
  }
}

// GET - Get reactions for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });
    }

    const reactions = await db.select().from(schema.broadcastReactions)
      .where(eq(schema.broadcastReactions.broadcastId, broadcastId));

    return NextResponse.json({ reactions });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }
}
