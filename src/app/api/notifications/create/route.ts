import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const {
      userId,
      userType,
      type,
      title,
      message,
      priority = "medium",
      metadata = {},
    } = body;

    if (!userId || !userType || !type || !title || !message) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userType, type, title, message" },
        { status: 400 }
      );
    }

    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority. Must be one of: low, medium, high, urgent" },
        { status: 400 }
      );
    }

    // ARLs can create notifications for any user; others only for themselves
    if (session.userType !== "arl" && session.id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const notification = await createNotification({
      userId,
      userType,
      type,
      title,
      message,
      priority,
      metadata,
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
