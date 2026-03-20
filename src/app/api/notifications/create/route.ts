import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { createNotification, type NotificationType, type NotificationPriority } from "@/lib/notifications";
import { validate, createNotificationSchema } from "@/lib/validations";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await req.json();
    const parsed = validate(createNotificationSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { userId, userType, type, title, message, priority = "normal", metadata = {} } = parsed.data;

    // ARLs can create notifications for any user; others only for themselves
    if (session.userType !== "arl" && session.id !== userId) {
      return ApiErrors.forbidden();
    }

    const notification = await createNotification({
      userId,
      userType,
      type: type as NotificationType,
      title,
      message,
      priority: priority as NotificationPriority,
      metadata,
    });

    return apiSuccess({ success: true, notification });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return ApiErrors.internal();
  }
}
