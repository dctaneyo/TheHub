import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { consumePendingForceAction } from "@/lib/socket-server";

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

    // Check if an ARL force-terminated this session
    const forceAction = consumePendingForceAction(myToken);
    if (forceAction) {
      return NextResponse.json({
        success: false,
        force: forceAction.action,
        token: forceAction.token,
        redirectTo: forceAction.redirectTo,
      });
    }

    // Also check if the session record still exists (it's deleted on force actions)
    const existing = db.select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, myToken),
          eq(schema.sessions.userId, session.id)
        )
      )
      .get();

    if (!existing) {
      // Session was deleted (force-terminated) — tell client to logout
      return NextResponse.json({ success: false, force: "logout" });
    }

    db.update(schema.sessions)
      .set({ isOnline: true, lastSeen: new Date().toISOString() })
      .where(eq(schema.sessions.id, existing.id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
