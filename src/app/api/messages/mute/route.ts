import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// POST - toggle mute for a conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

    const existing = db
      .select()
      .from(schema.conversationSettings)
      .where(
        and(
          eq(schema.conversationSettings.conversationId, conversationId),
          eq(schema.conversationSettings.userId, session.id),
          eq(schema.conversationSettings.userType, session.userType)
        )
      )
      .get();

    const now = new Date().toISOString();

    if (existing) {
      const newMuted = !existing.isMuted;
      db.update(schema.conversationSettings)
        .set({ isMuted: newMuted, updatedAt: now })
        .where(eq(schema.conversationSettings.id, existing.id))
        .run();
      return NextResponse.json({ isMuted: newMuted });
    } else {
      db.insert(schema.conversationSettings).values({
        id: uuid(),
        conversationId,
        userId: session.id,
        userType: session.userType,
        isMuted: true,
        createdAt: now,
        updatedAt: now,
      }).run();
      return NextResponse.json({ isMuted: true });
    }
  } catch (error) {
    console.error("Mute toggle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - check mute status for a conversation
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

    const setting = db
      .select()
      .from(schema.conversationSettings)
      .where(
        and(
          eq(schema.conversationSettings.conversationId, conversationId),
          eq(schema.conversationSettings.userId, session.id),
          eq(schema.conversationSettings.userType, session.userType)
        )
      )
      .get();

    return NextResponse.json({ isMuted: setting?.isMuted ?? false });
  } catch (error) {
    console.error("Mute GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
