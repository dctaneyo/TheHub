import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { broadcastStreamMessage } from "@/lib/socket-emit";

// POST - Send a message in broadcast chat
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { broadcastId, content, timestamp } = body;

    if (!broadcastId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    // Broadcast message via socket
    broadcastStreamMessage(broadcastId, {
      senderName: session.name,
      content,
      timestamp: timestamp || 0,
    });

    return NextResponse.json({ messageId });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

// GET - Get messages for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });
    }

    const messages = await db.select().from(schema.broadcastMessages)
      .where(eq(schema.broadcastMessages.broadcastId, broadcastId));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
