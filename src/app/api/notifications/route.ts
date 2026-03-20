import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  getNotifications,
  getNotificationCounts,
  markAllNotificationsRead,
  deleteAllNotifications,
  autoDismissOldNotifications,
} from "@/lib/notifications";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread_only") === "true";
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;

    // ARLs can fetch notifications for a specific location (mirror mode)
    const userId = (session.userType === "arl" && searchParams.get("locationId")) || session.id;

    // Auto-dismiss notifications older than 2 days
    await autoDismissOldNotifications(userId);

    const [notificationsList, counts] = await Promise.all([
      getNotifications(userId, { limit, offset, unreadOnly, type, priority }),
      getNotificationCounts(userId),
    ]);

    const notifications = notificationsList.map((n) => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
    }));

    return apiSuccess({
      notifications,
      total: counts.total,
      unread: counts.unread,
      urgent: counts.urgent,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    const { action } = await req.json();

    if (action === "mark_all_read") {
      await markAllNotificationsRead(session.id);
      const counts = await getNotificationCounts(session.id);
      return apiSuccess({ counts });
    }

    if (action === "dismiss_all") {
      await deleteAllNotifications(session.id);
      return apiSuccess({ counts: { total: 0, unread: 0, urgent: 0 } });
    }

    return ApiErrors.badRequest("Invalid action");
  } catch (error) {
    console.error("Error handling notification action:", error);
    return ApiErrors.internal();
  }
}
