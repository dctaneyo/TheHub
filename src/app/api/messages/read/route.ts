import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastMessageRead } from "@/lib/socket-emit";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST mark messages as read
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { messageIds } = await req.json();

    if (!messageIds || !Array.isArray(messageIds)) {
      return ApiErrors.badRequest("messageIds array is required");
    }

    const now = new Date().toISOString();

    // Verify caller has access to the conversations these messages belong to
    const verifiedConvIds = new Set<string>();
    const deniedConvIds = new Set<string>();

    for (const messageId of messageIds) {
      const msg = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
      if (!msg) continue;

      if (!verifiedConvIds.has(msg.conversationId) && !deniedConvIds.has(msg.conversationId)) {
        const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, msg.conversationId)).get();
        if (!conv) { deniedConvIds.add(msg.conversationId); continue; }
        if (conv.type === "direct") {
          if (conv.participantAId !== session.id && conv.participantBId !== session.id) {
            deniedConvIds.add(msg.conversationId); continue;
          }
        } else if (conv.type !== "global") {
          const member = db.select().from(schema.conversationMembers)
            .where(and(eq(schema.conversationMembers.conversationId, conv.id), eq(schema.conversationMembers.memberId, session.id)))
            .get();
          if (!member) { deniedConvIds.add(msg.conversationId); continue; }
        }
        verifiedConvIds.add(msg.conversationId);
      }

      if (deniedConvIds.has(msg.conversationId)) continue;

      // Check if already read
      const existing = db
        .select()
        .from(schema.messageReads)
        .where(
          and(
            eq(schema.messageReads.messageId, messageId),
            eq(schema.messageReads.readerId, session.id)
          )
        )
        .get();

      if (!existing) {
        db.insert(schema.messageReads).values({
          id: uuid(),
          messageId,
          readerType: session.userType,
          readerId: session.id,
          readAt: now,
        }).run();
      }
    }

    // Broadcast read receipts for verified conversations
    for (const convId of verifiedConvIds) {
      broadcastMessageRead(convId, session.id);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return ApiErrors.internal();
  }
}
