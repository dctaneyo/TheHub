import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// POST mark messages as read
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { messageIds } = await req.json();

    if (!messageIds || !Array.isArray(messageIds)) {
      return NextResponse.json({ error: "messageIds array is required" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
