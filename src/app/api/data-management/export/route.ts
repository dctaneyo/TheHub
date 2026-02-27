import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    // Export all data
    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: session.name,
      data: {
        locations: db.select().from(schema.locations).all(),
        arls: db.select().from(schema.arls).all(),
        tasks: db.select().from(schema.tasks).all(),
        taskCompletions: db.select().from(schema.taskCompletions).all(),
        conversations: db.select().from(schema.conversations).all(),
        conversationMembers: db.select().from(schema.conversationMembers).all(),
        messages: db.select().from(schema.messages).all(),
        messageReads: db.select().from(schema.messageReads).all(),
        messageReactions: db.select().from(schema.messageReactions).all(),
        sessions: db.select().from(schema.sessions).all(),
        forms: db.select().from(schema.forms).all(),
        emergencyMessages: db.select().from(schema.emergencyMessages).all(),
        notifications: db.select().from(schema.notifications).all(),
        pendingSessions: db.select().from(schema.pendingSessions).all(),
        pushSubscriptions: db.select().from(schema.pushSubscriptions).all(),
        broadcasts: db.select().from(schema.broadcasts).all(),
        broadcastViewers: db.select().from(schema.broadcastViewers).all(),
        broadcastReactions: db.select().from(schema.broadcastReactions).all(),
        broadcastMessages: db.select().from(schema.broadcastMessages).all(),
        broadcastQuestions: db.select().from(schema.broadcastQuestions).all(),
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
