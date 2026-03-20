import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { broadcastConversationUpdate } from "@/lib/socket-emit";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST - soft-delete (hide) a conversation for the current user
// The conversation and its messages are preserved; starting a new direct chat
// with the same person will create a fresh thread (old history stays hidden).
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { conversationId } = await req.json();
    if (!conversationId) return ApiErrors.badRequest("conversationId required");

    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();
    if (!conv) return ApiErrors.notFound("Conversation");

    // Don't allow deleting global chat
    if (conv.type === "global") {
      return ApiErrors.forbidden("Cannot delete global chat");
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

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return ApiErrors.internal();
  }
}
