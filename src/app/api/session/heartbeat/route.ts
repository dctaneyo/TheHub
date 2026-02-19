import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const myToken = cookieStore.get("hub-token")?.value ?? null;
    if (!myToken) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    db.update(schema.sessions)
      .set({ isOnline: true, lastSeen: new Date().toISOString() })
      .where(
        and(
          eq(schema.sessions.token, myToken),
          eq(schema.sessions.userId, session.id)
        )
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
