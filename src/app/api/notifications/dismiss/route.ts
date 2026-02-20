import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { broadcastNotificationDismissed } from "@/lib/socket-emit";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationIds } = await request.json();

    if (!Array.isArray(notificationIds)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Update notifications to dismissed
    if (notificationIds.length > 0 && session.locationId) {
      // For multiple IDs, update them individually
      for (const id of notificationIds) {
        await db
          .update(schema.notifications)
          .set({ isDismissed: true })
          .where(
            and(
              eq(schema.notifications.locationId, session.locationId),
              eq(schema.notifications.id, id)
            )
          );
      }
    }

    // Broadcast to other kiosks at the same location so they sync immediately
    if (notificationIds.length > 0 && session.locationId) {
      broadcastNotificationDismissed(session.locationId, notificationIds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing notifications:", error);
    return NextResponse.json({ error: "Failed to dismiss notifications" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get dismissed notification IDs for this location
    if (!session.locationId) {
      return NextResponse.json({ dismissedIds: [] });
    }

    const dismissedNotifications = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.locationId, session.locationId),
          eq(schema.notifications.isDismissed, true)
        )
      );

    const dismissedIds = dismissedNotifications.map(n => n.id);

    return NextResponse.json({ dismissedIds });
  } catch (error) {
    console.error("Error fetching dismissed notifications:", error);
    return NextResponse.json({ error: "Failed to fetch dismissed notifications" }, { status: 500 });
  }
}
