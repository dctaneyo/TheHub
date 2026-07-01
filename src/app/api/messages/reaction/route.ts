import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastConversationUpdate } from "@/lib/socket-emit";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { messageId, emoji } = await request.json();

    if (!messageId || !emoji) {
      return ApiErrors.badRequest("Missing messageId or emoji");
    }

    // Check if message exists and caller has access to the conversation
    const message = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
    if (!message) {
      return ApiErrors.notFound("Message");
    }

    // Verify caller is a participant in this conversation
    const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, message.conversationId)).get();
    if (!conv) return ApiErrors.notFound("Conversation");
    if (conv.type === "direct") {
      if (conv.participantAId !== session.id && conv.participantBId !== session.id) {
        return ApiErrors.forbidden("Not a participant in this conversation");
      }
    } else {
      // group/global — check membership
      const member = db.select().from(schema.conversationMembers)
        .where(and(eq(schema.conversationMembers.conversationId, conv.id), eq(schema.conversationMembers.memberId, session.id)))
        .get();
      if (!member && conv.type !== "global") {
        return ApiErrors.forbidden("Not a member of this conversation");
      }
    }

    // One reaction per user per message. Find any existing reaction from
    // this user on this message (any emoji).
    const existing = db.select().from(schema.messageReactions)
      .where(and(
        eq(schema.messageReactions.messageId, messageId),
        eq(schema.messageReactions.userId, session.id),
      )).get();

    if (existing) {
      // Same emoji → toggle off. Different emoji → remove old and add new below.
      db.delete(schema.messageReactions).where(eq(schema.messageReactions.id, existing.id)).run();
      if (existing.emoji === emoji) {
        broadcastConversationUpdate(message.conversationId);
        return apiSuccess({ success: true, action: "removed" });
      }
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

    broadcastConversationUpdate(message.conversationId);
    return apiSuccess({ success: true, action: "added" });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return ApiErrors.internal();
  }
}
