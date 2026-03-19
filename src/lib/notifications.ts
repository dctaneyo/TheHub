import { db } from "@/lib/db";
import { notifications, notificationPreferences } from "@/lib/db/schema";
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
 * Map from NotificationType (snake_case) to the corresponding
 * boolean column on the notification_preferences table (camelCase).
 */
const NOTIFICATION_TYPE_TO_PREF: Partial<Record<NotificationType, keyof typeof notificationPreferences.$inferSelect>> = {
  task_due_soon: "taskDueSoon",
  task_overdue: "taskOverdue",
  task_completed: "taskCompleted",
  new_message: "newMessage",
  new_shoutout: "newShoutout",
  location_online: "locationOnline",
  location_offline: "locationOffline",
  emergency_broadcast: "emergencyBroadcast",
  meeting_starting: "meetingStarted",
  system_update: "systemAlert",
};

/**
 * Check if a notification is allowed by user preferences.
 * Returns true if allowed (send it), false if user has opted out.
 * Emergency/urgent notifications and unknown types always pass.
 */
async function isNotificationAllowed(
  userId: string,
  type: NotificationType,
  priority: NotificationPriority = "normal"
): Promise<boolean> {
  // Urgent notifications always pass
  if (priority === "urgent") return true;
  // Emergency broadcasts always pass
  if (type === "emergency_broadcast") return true;

  try {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // No preferences saved — use defaults (allow)
    if (!prefs) return true;

    // Check in-app delivery toggle
    if (!prefs.inAppNotifications) return false;

    // Check specific type toggle
    const prefKey = NOTIFICATION_TYPE_TO_PREF[type];
    if (!prefKey) return true; // Unknown type → allow by default

    return (prefs as any)[prefKey] === true;
  } catch (err) {
    // On error, allow notification to prevent missing critical alerts
    console.error("Error checking notification preferences:", err);
    return true;
  }
}

/**
 * Create a new notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification | null> {
  // Check user preferences before creating
  const allowed = await isNotificationAllowed(params.userId, params.type, params.priority);
  if (!allowed) return null;

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

  // Filter users by their notification preferences
  const priority = params.priority || "normal";
  const allowedUserIds: string[] = [];
  for (const userId of userIds) {
    const allowed = await isNotificationAllowed(userId, params.type, priority);
    if (allowed) allowedUserIds.push(userId);
  }
  if (allowedUserIds.length === 0) return;

  const notificationRecords = allowedUserIds.map((userId) => ({
    id: uuid(),
    userId,
    userType: params.userType,
    type: params.type,
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl || null,
    actionLabel: params.actionLabel || null,
    priority,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  }));

  await db.insert(notifications).values(notificationRecords);

  // Broadcast via WebSocket to each user
  for (const record of notificationRecords) {
    const counts = await getNotificationCounts(record.userId);
    broadcastNotification(record.userId, record, counts);
  }
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

  const results = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Get notification counts for a user
 */
export async function getNotificationCounts(userId: string) {
  const [result] = await db
    .select({
      total: sql<number>`count(*)`,
      unread: sql<number>`sum(case when ${notifications.isRead} = 0 then 1 else 0 end)`,
      urgent: sql<number>`sum(case when ${notifications.isRead} = 0 and ${notifications.priority} = 'urgent' then 1 else 0 end)`,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return {
    total: result?.total || 0,
    unread: result?.unread || 0,
    urgent: result?.urgent || 0,
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
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  await db.delete(notifications).where(eq(notifications.userId, userId));
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
