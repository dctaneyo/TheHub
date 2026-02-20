import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { broadcastConversationUpdate } from "@/lib/socket-emit";

// POST - soft-delete (hide) a conversation for the current user
// The conversation and its messages are preserved; starting a new direct chat
// with the same person will create a fresh thread (old history stays hidden).
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    // Don't allow deleting global chat
    if (conv.type === "global") {
      return NextResponse.json({ error: "Cannot delete global chat" }, { status: 403 });
    }

    // Add current user to deletedBy array
    const deletedBy: string[] = JSON.parse(conv.deletedBy || "[]");
    if (!deletedBy.includes(session.id)) {
      deletedBy.push(session.id);
    }

    db.update(schema.conversations)
      .set({ deletedBy: JSON.stringify(deletedBy) })
      .where(eq(schema.conversations.id, conversationId))
      .run();

    // Notify all members so sibling kiosks (same location) also hide the conversation
    broadcastConversationUpdate(conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
