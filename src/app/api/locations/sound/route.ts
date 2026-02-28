import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { broadcastSoundToggle } from "@/lib/socket-emit";

// GET — dashboard fetches its own mute state on mount
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const loc = db.select({ soundMuted: schema.locations.soundMuted })
      .from(schema.locations)
      .where(eq(schema.locations.id, session.userId))
      .get();
    if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ muted: loc.soundMuted });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — ARL or the location itself toggles mute
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { locationId, muted } = await req.json();

    // ARL can target any location; a location can only toggle itself
    const targetId = session.userType === "arl" ? locationId : session.userId;
    if (!targetId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
    if (session.userType === "location" && targetId !== session.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    db.update(schema.locations)
      .set({ soundMuted: muted, updatedAt: new Date().toISOString() })
      .where(eq(schema.locations.id, targetId))
      .run();

    broadcastSoundToggle(targetId, muted);
    return NextResponse.json({ ok: true, muted });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
