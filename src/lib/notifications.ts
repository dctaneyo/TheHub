import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastNotification, broadcastNotificationRead, broadcastNotificationDeleted } from "./socket-emit";

export type NotificationType =
  // For Locations
  | "task_due_soon"
  | "task_overdue"
  | "new_message"
  | "new_shoutout"
  | "achievement_unlocked"
  | "high_five"
  | "emergency_broadcast"
  | "meeting_starting"
  | "form_uploaded"
  // For ARLs
  | "task_completed"
  | "location_online"
  | "location_offline"
  | "task_overdue_location"
  | "meeting_joined"
  | "analytics_alert"
  | "system_update";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationParams {
  userId: string;
  userType: "location" | "arl" | "admin";
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

export interface Notification {
  id: string;
  userId: string;
  userType: "location" | "arl" | "admin";
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  priority: string;
  metadata: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Create a new notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification> {
  const id = uuid();
  const notification = {
    id,
    userId: params.userId,
    userType: params.userType,
    type: params.type,
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl || null,
    actionLabel: params.actionLabel || null,
    priority: params.priority || "normal",
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  await db.insert(notifications).values(notification);
  
  // Broadcast via WebSocket
  const counts = await getNotificationCounts(params.userId);
  broadcastNotification(params.userId, notification, counts);
  
  return notification as Notification;
}

/**
 * Create notifications for multiple users (bulk)
 */
export async function createNotificationBulk(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
): Promise<void> {
  if (userIds.length === 0) return;

  const notificationRecords = userIds.map((userId) => ({
    id: uuid(),
    userId,
    userType: params.userType,
    type: params.type,
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl || null,
    actionLabel: params.actionLabel || null,
    priority: params.priority || "normal",
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  }));

  await db.insert(notifications).values(notificationRecords);
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
    priority?: string;
  } = {}
) {
  const { limit = 50, offset = 0, unreadOnly = false, type, priority } = options;

  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  // Apply filters
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }
  if (type) {
    conditions.push(eq(notifications.type, type));
  }
  if (priority) {
    conditions.push(eq(notifications.priority, priority));
  }

  if (conditions.length > 1) {
    query = db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const results = await query;
  return results;
}

/**
 * Get notification counts for a user
 */
export async function getNotificationCounts(userId: string) {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  const [urgentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        eq(notifications.priority, "urgent")
      )
    );

  return {
    total: totalResult?.count || 0,
    unread: unreadResult?.count || 0,
    urgent: urgentResult?.count || 0,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date().toISOString(),
    })
    .where(eq(notifications.id, notificationId));
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date().toISOString(),
    })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await db.delete(notifications).where(eq(notifications.id, notificationId));
}

/**
 * Delete old read notifications (cleanup job)
 */
export async function deleteOldNotifications(daysOld: number = 30): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();

  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.isRead, true),
        sql`${notifications.readAt} < ${cutoffISO}`
      )
    );
}
