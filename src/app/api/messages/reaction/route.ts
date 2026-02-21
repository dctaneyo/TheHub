import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, emoji } = await request.json();

    if (!messageId || !emoji) {
      return NextResponse.json({ error: "Missing messageId or emoji" }, { status: 400 });
    }

    // Check if message exists
    const message = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Toggle: if user already reacted with this emoji, remove it; otherwise add it
    const existing = db.select().from(schema.messageReactions)
      .where(and(
        eq(schema.messageReactions.messageId, messageId),
        eq(schema.messageReactions.userId, session.id),
        eq(schema.messageReactions.emoji, emoji),
      )).get();

    if (existing) {
      db.delete(schema.messageReactions).where(eq(schema.messageReactions.id, existing.id)).run();
      return NextResponse.json({ success: true, action: "removed" });
    }

    db.insert(schema.messageReactions).values({
      id: uuid(),
      messageId,
      userId: session.id,
      userType: session.userType,
      userName: session.name || "Unknown",
      emoji,
      createdAt: new Date().toISOString(),
    }).run();

    return NextResponse.json({ success: true, action: "added" });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
