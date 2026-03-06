import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    // Export all data
    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: session.name,
      data: {
        locations: await db.select().from(schema.locations).all(),
        arls: await db.select().from(schema.arls).all(),
        tasks: await db.select().from(schema.tasks).all(),
        taskCompletions: await db.select().from(schema.taskCompletions).all(),
        conversations: await db.select().from(schema.conversations).all(),
        conversationMembers: await db.select().from(schema.conversationMembers).all(),
        messages: await db.select().from(schema.messages).all(),
        messageReads: await db.select().from(schema.messageReads).all(),
        messageReactions: await db.select().from(schema.messageReactions).all(),
        sessions: await db.select().from(schema.sessions).all(),
        forms: await db.select().from(schema.forms).all(),
        emergencyMessages: await db.select().from(schema.emergencyMessages).all(),
        notifications: await db.select().from(schema.notifications).all(),
        pendingSessions: await db.select().from(schema.pendingSessions).all(),
        pushSubscriptions: await db.select().from(schema.pushSubscriptions).all(),
        broadcasts: await db.select().from(schema.broadcasts).all(),
        broadcastViewers: await db.select().from(schema.broadcastViewers).all(),
        broadcastReactions: await db.select().from(schema.broadcastReactions).all(),
        broadcastMessages: await db.select().from(schema.broadcastMessages).all(),
        broadcastQuestions: await db.select().from(schema.broadcastQuestions).all(),
      },
    };

    // Return as JSON file download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="hub-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
