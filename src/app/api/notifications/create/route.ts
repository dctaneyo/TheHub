import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";
import { createNotification, Notification } from "@/lib/notifications";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as { userId: string; userType: string };
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

    // Validate priority
    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority. Must be one of: low, medium, high, urgent" },
        { status: 400 }
      );
    }

    // For testing purposes, allow ARL users to create notifications for locations
    if (decoded.userType !== "arl" && decoded.userId !== userId) {
      return NextResponse.json(
        { error: "Can only create notifications for yourself" },
        { status: 403 }
      );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
