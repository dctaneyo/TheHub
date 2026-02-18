import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // The sessionCode in the JWT payload is unique to this browser's login
    const myCode = session.sessionCode ?? null;

    // Return only ONLINE sessions for this user so the popdown only shows active ones
    const onlineSessions = db
      .select({
        sessionCode: schema.sessions.sessionCode,
        isOnline: schema.sessions.isOnline,
        deviceType: schema.sessions.deviceType,
        createdAt: schema.sessions.createdAt,
        lastSeen: schema.sessions.lastSeen,
        id: schema.sessions.id,
        token: schema.sessions.token,
      })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, session.id),
          eq(schema.sessions.isOnline, true)
        )
      )
      .orderBy(desc(schema.sessions.createdAt))
      .all();

    // Get the current browser's token to mark which entry is "this" session
    const cookieStore = await cookies();
    const myToken = cookieStore.get("hub-token")?.value ?? null;

    return NextResponse.json({
      sessionCode: myCode,
      sessions: onlineSessions.map((s) => ({
        id: s.id,
        code: s.sessionCode ?? "------",
        isOnline: s.isOnline,
        deviceType: s.deviceType,
        createdAt: s.createdAt,
        lastSeen: s.lastSeen,
        isCurrent: myToken ? s.token === myToken : s.sessionCode === myCode,
      })),
    });
  } catch (error) {
    console.error("Session code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
