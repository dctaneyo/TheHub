import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.locationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, title, body, referenceId } = await request.json();

    if (!type || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if notification already exists and is not dismissed
    const existingNotification = await db
      .select()
      .from(schema.notifications)
      .where(
        eq(schema.notifications.referenceId, referenceId)
      )
      .limit(1);

    if (existingNotification.length > 0 && !existingNotification[0].isDismissed) {
      // Notification already exists and is not dismissed, don't create duplicate
      return NextResponse.json({ success: true, existing: true });
    }

    // Create new notification
    const notification = await db
      .insert(schema.notifications)
      .values({
        id: nanoid(),
        locationId: session.locationId,
        type,
        title,
        body: body || null,
        referenceId: referenceId || null,
        isRead: false,
        isDismissed: false,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json({ success: true, notification: notification[0] });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}
