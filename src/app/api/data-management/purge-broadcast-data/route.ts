import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    let deletedBroadcasts = 0;
    let deletedMessages = 0;
    let deletedQuestions = 0;
    let deletedReactions = 0;
    let deletedViewers = 0;

    try { deletedViewers = sqlite.prepare("DELETE FROM broadcast_viewers").run().changes; } catch {}
    try { deletedReactions = sqlite.prepare("DELETE FROM broadcast_reactions").run().changes; } catch {}
    try { deletedMessages = sqlite.prepare("DELETE FROM broadcast_messages").run().changes; } catch {}
    try { deletedQuestions = sqlite.prepare("DELETE FROM broadcast_questions").run().changes; } catch {}
    try { deletedBroadcasts = sqlite.prepare("DELETE FROM broadcasts").run().changes; } catch {}

    return NextResponse.json({
      success: true,
      deletedBroadcasts,
      deletedMessages,
      deletedQuestions,
      deletedReactions,
      deletedViewers,
    });
  } catch (error) {
    console.error("Purge broadcast data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
