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

    // Check if message exists
    const message = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
    if (!message) {
      return ApiErrors.notFound("Message");
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
      broadcastConversationUpdate(message.conversationId);
      return apiSuccess({ success: true, action: "removed" });
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
