import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";
import {
  getNotifications,
  getNotificationCounts,
  markAllNotificationsRead,
  Notification,
} from "@/lib/notifications";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as { userId: string; userType: string };
    const { searchParams } = new URL(req.url);

    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread_only") === "true";
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;

    const [notificationsList, counts] = await Promise.all([
      getNotifications(decoded.userId, {
        limit,
        offset,
        unreadOnly,
        type,
        priority,
      }),
      getNotificationCounts(decoded.userId),
    ]);

    // Parse metadata from JSON strings
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
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as { userId: string; userType: string };
    const { action } = await req.json();

    if (action === "mark_all_read") {
      await markAllNotificationsRead(decoded.userId);
      const counts = await getNotificationCounts(decoded.userId);
      return NextResponse.json({ success: true, counts });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error handling notification action:", error);
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
