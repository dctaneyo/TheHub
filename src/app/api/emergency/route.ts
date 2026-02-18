import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET active emergency message (any authenticated user)
// For locations: only returns message if they are a target (or message targets all)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const active = db.select().from(schema.emergencyMessages)
      .where(eq(schema.emergencyMessages.isActive, true)).all();

    const latest = active.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0] || null;

    if (!latest) return NextResponse.json({ message: null });

    // For location sessions: filter by targetLocationIds and already-viewed
    if (session.userType === "location") {
      const targets: string[] | null = latest.targetLocationIds
        ? JSON.parse(latest.targetLocationIds)
        : null;
      if (targets && !targets.includes(session.id)) {
        return NextResponse.json({ message: null });
      }
      // If this location already viewed/dismissed it, don't show again (survives logout)
      const viewedByCheck: string[] = latest.viewedBy ? JSON.parse(latest.viewedBy) : [];
      if (viewedByCheck.includes(session.id)) {
        return NextResponse.json({ message: null });
      }
    }

    const viewedBy: string[] = latest.viewedBy ? JSON.parse(latest.viewedBy) : [];
    return NextResponse.json({
      message: {
        ...latest,
        viewedBy,
        targetLocationIds: latest.targetLocationIds ? JSON.parse(latest.targetLocationIds) : null,
      }
    });
  } catch (error) {
    console.error("Get emergency error:", error);
    return NextResponse.json({ message: null });
  }
}

// POST send emergency message (ARL only)
// Body: { message, targetLocationIds?: string[] | null }  (null = all)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL only" }, { status: 403 });
    }

    const { message, targetLocationIds } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

    // Deactivate all previous messages
    db.update(schema.emergencyMessages)
      .set({ isActive: false })
      .where(eq(schema.emergencyMessages.isActive, true)).run();

    const now = new Date().toISOString();
    const id = uuid();
    db.insert(schema.emergencyMessages).values({
      id,
      message: message.trim(),
      sentBy: session.id,
      sentByName: session.name,
      isActive: true,
      targetLocationIds: targetLocationIds && targetLocationIds.length > 0
        ? JSON.stringify(targetLocationIds)
        : null,
      viewedBy: "[]",
      createdAt: now,
    }).run();

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Send emergency error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH mark message as viewed by current location
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Location only" }, { status: 403 });
    }

    const { messageId } = await req.json();
    if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

    const msg = db.select().from(schema.emergencyMessages)
      .where(eq(schema.emergencyMessages.id, messageId)).get();
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const viewedBy: string[] = msg.viewedBy ? JSON.parse(msg.viewedBy) : [];
    if (!viewedBy.includes(session.id)) {
      viewedBy.push(session.id);
      db.update(schema.emergencyMessages)
        .set({ viewedBy: JSON.stringify(viewedBy) })
        .where(eq(schema.emergencyMessages.id, messageId)).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark viewed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE clear emergency message (ARL only)
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL only" }, { status: 403 });
    }

    db.update(schema.emergencyMessages)
      .set({ isActive: false })
      .where(eq(schema.emergencyMessages.isActive, true)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear emergency error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
