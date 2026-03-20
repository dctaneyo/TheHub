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

    for (const messageId of messageIds) {
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

    // Get conversation IDs for these messages to broadcast read receipts
    const conversationIds = new Set<string>();
    for (const messageId of messageIds) {
      const msg = db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
      if (msg) conversationIds.add(msg.conversationId);
    }
    for (const convId of conversationIds) {
      broadcastMessageRead(convId, session.id);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return ApiErrors.internal();
  }
}
