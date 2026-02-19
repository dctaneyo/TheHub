import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET active emergency message (any authenticated user)
// For locations: only returns message if they are a target (or message targets all)
// For ARLs: also returns history of past messages
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const all = db.select().from(schema.emergencyMessages)
      .orderBy(schema.emergencyMessages.createdAt).all();

    const active = all.filter((m) => m.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

    if (session.userType === "arl") {
      // ARLs get the active message + full history
      const history = all
        .filter((m) => !m.isActive)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((m) => ({
          ...m,
          viewedBy: m.viewedBy ? JSON.parse(m.viewedBy) : [],
          targetLocationIds: m.targetLocationIds ? JSON.parse(m.targetLocationIds) : null,
        }));
      return NextResponse.json({
        message: active ? {
          ...active,
          viewedBy: active.viewedBy ? JSON.parse(active.viewedBy) : [],
          targetLocationIds: active.targetLocationIds ? JSON.parse(active.targetLocationIds) : null,
        } : null,
        history,
      });
    }

    // Location: filter by target and already-viewed
    if (!active) return NextResponse.json({ message: null });

    const targets: string[] | null = active.targetLocationIds
      ? JSON.parse(active.targetLocationIds)
      : null;
    if (targets && !targets.includes(session.id)) {
      return NextResponse.json({ message: null });
    }
    const viewedByCheck: string[] = active.viewedBy ? JSON.parse(active.viewedBy) : [];
    if (viewedByCheck.includes(session.id)) {
      return NextResponse.json({ message: null });
    }

    return NextResponse.json({
      message: {
        ...active,
        viewedBy: viewedByCheck,
        targetLocationIds: targets,
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
// Auto-archives when all targeted recipients have viewed it
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
    }

    // Determine if all targets have now viewed it
    const targets: string[] | null = msg.targetLocationIds
      ? JSON.parse(msg.targetLocationIds)
      : null;

    let shouldArchive = false;
    if (targets) {
      // Targeted broadcast: archive when all targeted locations have viewed
      shouldArchive = targets.every((id) => viewedBy.includes(id));
    } else {
      // All-locations broadcast: we can't know total count here, so just track views
      // ARLs can manually clear; auto-archive only for targeted broadcasts
      shouldArchive = false;
    }

    db.update(schema.emergencyMessages)
      .set({ viewedBy: JSON.stringify(viewedBy), isActive: shouldArchive ? false : msg.isActive })
      .where(eq(schema.emergencyMessages.id, messageId)).run();

    return NextResponse.json({ success: true, archived: shouldArchive });
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
