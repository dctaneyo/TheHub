import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { consumePendingForceAction } from "@/lib/socket-server";
import { broadcastPresenceUpdate } from "@/lib/socket-emit";

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

    const now = new Date().toISOString();
    db.update(schema.sessions)
      .set({ isOnline: true, lastSeen: now })
      .where(eq(schema.sessions.id, existing.id))
      .run();

    // Emit presence:update so ARL hub sees a live lastSeen on every heartbeat
    if (session.userType === "location") {
      const loc = db.select({ name: schema.locations.name, storeNumber: schema.locations.storeNumber })
        .from(schema.locations).where(eq(schema.locations.id, session.userId)).get();
      if (loc) broadcastPresenceUpdate(session.userId, "location", loc.name, true, loc.storeNumber);
    } else {
      const arl = db.select({ name: schema.arls.name })
        .from(schema.arls).where(eq(schema.arls.id, session.userId)).get();
      if (arl) broadcastPresenceUpdate(session.userId, "arl", arl.name, true);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
