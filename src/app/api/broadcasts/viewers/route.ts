import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// POST - Join a broadcast as a viewer
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { broadcastId } = body;

    if (!broadcastId) {
      return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });
    }

    const viewerId = uuidv4();
    await db.insert(schema.broadcastViewers).values({
      id: viewerId,
      broadcastId,
      viewerType: session.userType,
      viewerId: session.userId,
      viewerName: session.name,
      joinedAt: new Date().toISOString(),
    });

    // Increment viewer count
    const broadcast = await db.select().from(schema.broadcasts)
      .where(eq(schema.broadcasts.id, broadcastId))
      .limit(1);

    if (broadcast.length > 0) {
      await db.update(schema.broadcasts)
        .set({ 
          viewerCount: (broadcast[0].viewerCount || 0) + 1,
          totalViews: (broadcast[0].totalViews || 0) + 1,
        })
        .where(eq(schema.broadcasts.id, broadcastId));
    }

    return NextResponse.json({ viewerId });
  } catch (error) {
    console.error("Error joining broadcast:", error);
    return NextResponse.json({ error: "Failed to join broadcast" }, { status: 500 });
  }
}

// PATCH - Update viewer status (minimize, dismiss, leave)
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { viewerId, broadcastId, isMinimized, isDismissed, leftAt, watchDuration, completionRate } = body;

    if (!viewerId) {
      return NextResponse.json({ error: "Viewer ID required" }, { status: 400 });
    }

    const updates: any = {};
    if (isMinimized !== undefined) updates.isMinimized = isMinimized;
    if (isDismissed !== undefined) updates.isDismissed = isDismissed;
    if (leftAt !== undefined) {
      updates.leftAt = leftAt;
      // Decrement viewer count when leaving
      if (broadcastId) {
        const broadcast = await db.select().from(schema.broadcasts)
          .where(eq(schema.broadcasts.id, broadcastId))
          .limit(1);
        
        if (broadcast.length > 0 && broadcast[0].viewerCount > 0) {
          await db.update(schema.broadcasts)
            .set({ viewerCount: broadcast[0].viewerCount - 1 })
            .where(eq(schema.broadcasts.id, broadcastId));
        }
      }
    }
    if (watchDuration !== undefined) updates.watchDuration = watchDuration;
    if (completionRate !== undefined) updates.completionRate = completionRate;

    await db.update(schema.broadcastViewers)
      .set(updates)
      .where(eq(schema.broadcastViewers.id, viewerId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating viewer:", error);
    return NextResponse.json({ error: "Failed to update viewer" }, { status: 500 });
  }
}

// GET - Get viewers for a broadcast
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

    const viewers = await db.select().from(schema.broadcastViewers)
      .where(eq(schema.broadcastViewers.broadcastId, broadcastId));

    return NextResponse.json({ viewers });
  } catch (error) {
    console.error("Error fetching viewers:", error);
    return NextResponse.json({ error: "Failed to fetch viewers" }, { status: 500 });
  }
}
