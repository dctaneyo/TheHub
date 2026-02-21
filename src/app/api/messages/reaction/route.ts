import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

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
    const message = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
    
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // For now, we'll just return a success response
    // In a real implementation, you'd store reactions in a separate table
    // and emit socket events for real-time updates
    
    return NextResponse.json({ 
      success: true, 
      messageId, 
      emoji,
      userId: session.userId,
      userName: (session as any).userName || "Unknown"
    });

  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
