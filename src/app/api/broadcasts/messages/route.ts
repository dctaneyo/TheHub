import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST - Send a message in broadcast chat
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { broadcastId, content, timestamp } = body;

    if (!broadcastId || !content) {
      return ApiErrors.badRequest("Missing required fields");
    }

    const messageId = uuidv4();
    await db.insert(schema.broadcastMessages).values({
      id: messageId,
      broadcastId,
      senderType: session.userType,
      senderId: session.userId,
      senderName: session.name,
      content,
      timestamp: timestamp || 0,
      createdAt: new Date().toISOString(),
    });

    return apiSuccess({ messageId });
  } catch (error) {
    console.error("Error sending message:", error);
    return ApiErrors.internal("Failed to send message");
  }
}

// GET - Get messages for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return ApiErrors.badRequest("Broadcast ID required");
    }

    const messages = await db.select().from(schema.broadcastMessages)
      .where(eq(schema.broadcastMessages.broadcastId, broadcastId));

    return apiSuccess({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return ApiErrors.internal("Failed to fetch messages");
  }
}
