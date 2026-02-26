import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, desc, or, isNull, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { emitTickerMessage, emitTickerDelete } from "@/lib/socket-emit";

// GET - fetch active ticker messages
export async function GET() {
  try {
    const now = new Date().toISOString();
    const messages = db
      .select()
      .from(schema.tickerMessages)
      .orderBy(desc(schema.tickerMessages.createdAt))
      .all()
      .filter((m) => !m.expiresAt || m.expiresAt > now);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Ticker GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - create a new ticker message (ARL only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, icon, expiresInMinutes } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    const id = uuid();
    const now = new Date().toISOString();
    const expiresAt = expiresInMinutes
      ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
      : null;

    db.insert(schema.tickerMessages).values({
      id,
      content: content.trim(),
      icon: icon || "📢",
      arlId: session.userId,
      arlName: session.name,
      expiresAt,
      createdAt: now,
    }).run();

    const msg = { id, content: content.trim(), icon: icon || "📢", arlId: session.userId, arlName: session.name, expiresAt, createdAt: now };

    // Broadcast to all locations via socket
    emitTickerMessage(msg);

    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error("Ticker POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - remove a ticker message (ARL only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    db.delete(schema.tickerMessages).where(eq(schema.tickerMessages.id, id)).run();

    emitTickerDelete(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ticker DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
