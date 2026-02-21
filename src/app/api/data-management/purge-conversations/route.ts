import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARL access required" }, { status: 401 });
    }

    // Delete all messages first (foreign key constraint)
    let deletedMessages = 0;
    try {
      const r = sqlite.prepare("DELETE FROM messages").run();
      deletedMessages = r.changes;
    } catch {}

    // Delete all message reads
    let deletedReads = 0;
    try {
      const r = sqlite.prepare("DELETE FROM message_reads").run();
      deletedReads = r.changes;
    } catch {}

    // Delete all message reactions
    let deletedReactions = 0;
    try {
      const r = sqlite.prepare("DELETE FROM message_reactions").run();
      deletedReactions = r.changes;
    } catch {}

    // Delete all conversation members
    let deletedMembers = 0;
    try {
      const r = sqlite.prepare("DELETE FROM conversation_members").run();
      deletedMembers = r.changes;
    } catch {}

    // Finally delete all conversations
    const result = sqlite.prepare("DELETE FROM conversations").run();

    return NextResponse.json({
      success: true,
      deletedConversations: result.changes,
      deletedMessages,
      deletedReads,
      deletedReactions,
      deletedMembers,
    });
  } catch (error) {
    console.error("Purge conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
