import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST - Join a broadcast as a viewer
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { broadcastId } = body;

    if (!broadcastId) {
      return ApiErrors.badRequest("Broadcast ID required");
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

    return apiSuccess({ viewerId });
  } catch (error) {
    console.error("Error joining broadcast:", error);
    return ApiErrors.internal("Failed to join broadcast");
  }
}

// PATCH - Update viewer status (minimize, dismiss, leave)
export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { viewerId, broadcastId, isMinimized, isDismissed, leftAt, watchDuration, completionRate } = body;

    if (!viewerId) {
      return ApiErrors.badRequest("Viewer ID required");
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

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Error updating viewer:", error);
    return ApiErrors.internal("Failed to update viewer");
  }
}

// GET - Get viewers for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return ApiErrors.badRequest("Broadcast ID required");
    }

    const viewers = await db.select().from(schema.broadcastViewers)
      .where(eq(schema.broadcastViewers.broadcastId, broadcastId));

    return apiSuccess({ viewers });
  } catch (error) {
    console.error("Error fetching viewers:", error);
    return ApiErrors.internal("Failed to fetch viewers");
  }
}
