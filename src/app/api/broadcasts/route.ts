import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { validate, createBroadcastSchema } from "@/lib/validations";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// GET - Fetch broadcasts (active, scheduled, or past)
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'live' | 'scheduled' | 'ended' | 'all'
    const limit = parseInt(searchParams.get("limit") || "50");

    const broadcasts = status && status !== "all"
      ? await db.select().from(schema.broadcasts)
          .where(eq(schema.broadcasts.status, status))
          .orderBy(desc(schema.broadcasts.createdAt))
          .limit(limit)
      : await db.select().from(schema.broadcasts)
          .orderBy(desc(schema.broadcasts.createdAt))
          .limit(limit);

    return apiSuccess({ broadcasts });
  } catch (error) {
    console.error("Error fetching broadcasts:", error);
    return ApiErrors.internal();
  }
}

// POST - Create/start a new broadcast
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = validate(createBroadcastSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { title, description, streamMode, targetAudience, targetLocationIds, scheduledFor } = parsed.data;

    const broadcastId = uuidv4();
    const now = new Date().toISOString();
    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();

    await db.insert(schema.broadcasts).values({
      id: broadcastId,
      tenantId: session.tenantId,
      arlId: session.userId,
      arlName: session.name || "ARL",
      title,
      description: description || null,
      status: isScheduled ? "scheduled" : "live",
      streamMode: streamMode || "video",
      targetAudience: targetAudience || "all",
      targetLocationIds: targetLocationIds ? JSON.stringify(targetLocationIds) : null,
      scheduledFor: scheduledFor || null,
      startedAt: isScheduled ? null : now,
      createdAt: now,
    });

    return apiSuccess({ broadcastId, status: isScheduled ? "scheduled" : "live" });
  } catch (error) {
    console.error("Error creating broadcast:", error);
    return ApiErrors.internal();
  }
}

// PATCH - Update broadcast status or details
export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { broadcastId, status, viewerCount, duration } = body;

    if (!broadcastId) {
      return ApiErrors.badRequest("Broadcast ID required");
    }

    const updates: any = {};
    
    if (status === "ended") {
      updates.status = "ended";
      updates.endedAt = new Date().toISOString();
      if (duration) updates.duration = duration;
    }
    
    if (status === "live") {
      updates.status = "live";
      updates.startedAt = new Date().toISOString();
    }
    
    if (viewerCount !== undefined) {
      updates.viewerCount = viewerCount;
    }

    await db.update(schema.broadcasts)
      .set(updates)
      .where(eq(schema.broadcasts.id, broadcastId));

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Error updating broadcast:", error);
    return ApiErrors.internal();
  }
}
