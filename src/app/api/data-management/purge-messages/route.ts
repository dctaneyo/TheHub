import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const messageCount = db.select().from(schema.messages).all().length;
    const readCount = db.select().from(schema.messageReads).all().length;
    let reactionCount = 0;
    try {
      reactionCount = db.select().from(schema.messageReactions).all().length;
    } catch {
      // Table may not exist yet
    }

    try { db.delete(schema.messageReactions).run(); } catch { /* table may not exist */ }
    db.delete(schema.messageReads).run();
    db.delete(schema.messages).run();

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
