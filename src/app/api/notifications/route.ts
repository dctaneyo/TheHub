import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import {
  getNotifications,
  getNotificationCounts,
  markAllNotificationsRead,
} from "@/lib/notifications";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread_only") === "true";
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;

    const [notificationsList, counts] = await Promise.all([
      getNotifications(session.id, { limit, offset, unreadOnly, type, priority }),
      getNotificationCounts(session.id),
    ]);

    const notifications = notificationsList.map((n) => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
    }));

    return NextResponse.json({
      notifications,
      total: counts.total,
      unread: counts.unread,
      urgent: counts.urgent,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { action } = await req.json();

    if (action === "mark_all_read") {
      await markAllNotificationsRead(session.id);
      const counts = await getNotificationCounts(session.id);
      return NextResponse.json({ success: true, counts });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error handling notification action:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
