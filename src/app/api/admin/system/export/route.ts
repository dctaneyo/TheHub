import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";

// Moved from /api/data-management/export — a full cross-tenant data dump
// was never safe to expose to tenant-level ARLs (every tenant's data, not
// just their own). Read-only, admin-session-gated.
export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: auth.session.name,
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

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="hub-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export data error:", error);
    return ApiErrors.internal();
  }
}
