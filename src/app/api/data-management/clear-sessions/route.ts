import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    const { mode } = await request.json();

    let deleted = 0;

    if (mode === "stale") {
      // Clear sessions older than 7 days that are offline
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const r = sqlite.prepare(
        "DELETE FROM sessions WHERE is_online = 0 AND last_seen < ?"
      ).run(sevenDaysAgo.toISOString());
      deleted = r.changes;
    } else if (mode === "all-offline") {
      // Clear all offline sessions
      const r = sqlite.prepare("DELETE FROM sessions WHERE is_online = 0").run();
      deleted = r.changes;
    } else if (mode === "force-all") {
      // Force logout everyone (except current session)
      const r = sqlite.prepare(
        "DELETE FROM sessions WHERE session_code != ?"
      ).run(session.sessionCode || "");
      deleted = r.changes;
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted, mode });
  } catch (error) {
    console.error("Clear sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
