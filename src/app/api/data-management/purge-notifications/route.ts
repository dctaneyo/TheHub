import { NextResponse } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

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
