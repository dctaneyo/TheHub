import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARL access required" }, { status: 401 });
    }

    let deletedNotifications = 0;
    let deletedEmergency = 0;

    try { deletedNotifications = sqlite.prepare("DELETE FROM notifications").run().changes; } catch {}
    try { deletedEmergency = sqlite.prepare("DELETE FROM emergency_messages").run().changes; } catch {}

    return NextResponse.json({
      success: true,
      deletedNotifications,
      deletedEmergency,
    });
  } catch (error) {
    console.error("Purge notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
