import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { markNotificationRead, deleteNotification } from "@/lib/notifications";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { broadcastNotificationRead, broadcastNotificationDeleted } from "@/lib/socket-emit";

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
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await markNotificationRead(notificationId);
    broadcastNotificationRead(session.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await deleteNotification(notificationId);
    broadcastNotificationDeleted(session.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
