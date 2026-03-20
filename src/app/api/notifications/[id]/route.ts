import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { markNotificationRead, deleteNotification } from "@/lib/notifications";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { broadcastNotificationRead, broadcastNotificationDeleted } from "@/lib/socket-emit";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id: notificationId } = await params;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification || notification.userId !== session.id) {
      return ApiErrors.notFound("Notification");
    }

    await markNotificationRead(notificationId);
    broadcastNotificationRead(session.id);

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return ApiErrors.internal();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id: notificationId } = await params;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification || notification.userId !== session.id) {
      return ApiErrors.notFound("Notification");
    }

    await deleteNotification(notificationId);
    broadcastNotificationDeleted(session.id);

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return ApiErrors.internal();
  }
}
