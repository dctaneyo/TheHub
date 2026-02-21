import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema, sqlite } from "@/lib/db";

// POST purge all messages, read receipts, and reactions
export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    // Count before deletion
    const messageCount = db.select().from(schema.messages).all().length;
    const readCount = db.select().from(schema.messageReads).all().length;
    const reactionCount = db.select().from(schema.messageReactions).all().length;

    // Delete all message reactions
    sqlite.prepare("DELETE FROM message_reactions").run();

    // Delete all message reads
    sqlite.prepare("DELETE FROM message_reads").run();

    // Delete all messages
    sqlite.prepare("DELETE FROM messages").run();

    return NextResponse.json({
      success: true,
      deletedMessages: messageCount,
      deletedReads: readCount,
      deletedReactions: reactionCount,
    });
  } catch (error) {
    console.error("Purge messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
