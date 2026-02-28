import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { lt, eq } from "drizzle-orm";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Find old message IDs
    const oldMessages = db.select({ id: schema.messages.id })
      .from(schema.messages)
      .where(lt(schema.messages.createdAt, cutoff))
      .all();

    if (oldMessages.length > 0) {
      // Delete reads for old messages first
      for (const msg of oldMessages) {
        db.delete(schema.messageReads)
          .where(eq(schema.messageReads.messageId, msg.id))
          .run();
      }
      // Delete old messages
      db.delete(schema.messages)
        .where(lt(schema.messages.createdAt, cutoff))
        .run();
    }

    return NextResponse.json({ success: true, purged: oldMessages.length });
  } catch (error) {
    console.error("Purge messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
