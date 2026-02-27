import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// GET - Fetch broadcasts (active, scheduled, or past)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    return NextResponse.json({ broadcasts });
  } catch (error) {
    console.error("Error fetching broadcasts:", error);
    return NextResponse.json({ error: "Failed to fetch broadcasts" }, { status: 500 });
  }
}

// POST - Create/start a new broadcast
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARLs only" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, streamMode, targetAudience, targetLocationIds, scheduledFor } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const broadcastId = uuidv4();
    const now = new Date().toISOString();
    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();

    await db.insert(schema.broadcasts).values({
      id: broadcastId,
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

    return NextResponse.json({ broadcastId, status: isScheduled ? "scheduled" : "live" });
  } catch (error) {
    console.error("Error creating broadcast:", error);
    return NextResponse.json({ error: "Failed to create broadcast" }, { status: 500 });
  }
}

// PATCH - Update broadcast status or details
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { broadcastId, status, viewerCount, duration } = body;

    if (!broadcastId) {
      return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating broadcast:", error);
    return NextResponse.json({ error: "Failed to update broadcast" }, { status: 500 });
  }
}
