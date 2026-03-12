import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface NotificationCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a notification should be sent based on user preferences
 * @param userId - The user ID to check preferences for
 * @param userType - The type of user ('arl', 'admin', 'location')
 * @param notificationType - The type of notification being sent
 * @returns Promise<boolean> - true if notification should be sent
 */
export async function shouldSendNotification(
  userId: string,
  userType: "arl" | "admin" | "location",
  notificationType: NotificationType
): Promise<NotificationCheckResult> {
  try {
    // Fetch user's notification preferences
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(
        eq(notificationPreferences.userId, userId)
      )
      .limit(1);

    // If no preferences exist, use defaults (allow notification)
    if (!preferences) {
      return { allowed: true, reason: "No preferences found, using defaults" };
    }

    // Check priority overrides first - urgent notifications always sent
    const priorityTypes = preferences.priorityTypes ? JSON.parse(preferences.priorityTypes) : [];
    if (priorityTypes.includes("urgent") && notificationType === "urgent") {
      return { allowed: true, reason: "Urgent notification override" };
    }

    // Check delivery method preference
    const deliveryMethod = getDeliveryMethod(notificationType);
    if (!deliveryMethod) {
      return { allowed: false, reason: "No delivery method configured" };
    }

    switch (deliveryMethod) {
      case "inApp":
        if (!preferences.inAppNotifications) {
          return { allowed: false, reason: "In-app notifications disabled" };
        }
        break;

      case "push":
        if (!preferences.pushNotifications) {
          return { allowed: false, reason: "Push notifications disabled" };
        }
        break;

      case "email":
        if (!preferences.emailNotifications) {
          return { allowed: false, reason: "Email notifications disabled" };
        }
        break;

      default:
        return { allowed: true };
    }

    // Check specific notification type preference
    const typeAllowed = checkNotificationType(preferences, notificationType);
    if (!typeAllowed) {
      return { allowed: false, reason: `Notification type ${notificationType} disabled` };
    }

    return { allowed: true, reason: "All checks passed" };
  } catch (error) {
    console.error("Error checking notification preferences:", error);
    // On error, allow notification to prevent missing critical alerts
    return { allowed: true, reason: "Error checking preferences, allowing notification" };
  }
}

/**
 * Get the delivery method for a notification type
 */
function getDeliveryMethod(notificationType: NotificationType): string | null {
  const deliveryMap: Record<NotificationType, string> = {
    taskDueSoon: "inApp",
    taskOverdue: "inApp",
    taskCompleted: "inApp",
    newMessage: "inApp",
    messageReply: "inApp",
    locationOnline: "inApp",
    locationOffline: "inApp",
    locationStatusChange: "inApp",
    emergencyBroadcast: "push", // Emergency broadcasts use push for urgency
    regularBroadcast: "inApp",
    meetingStarted: "inApp",
    meetingEnded: "inApp",
    meetingReminder: "inApp",
    newShoutout: "inApp",
    leaderboardUpdate: "email", // Weekly reports via email
    systemAlert: "push", // Critical alerts use push
    weeklyReport: "email",
  };

  return deliveryMap[notificationType] || null;
}

/**
 * Check if a specific notification type is enabled for the user
 */
function checkNotificationType(
  preferences: typeof notificationPreferences.$inferSelect,
  notificationType: NotificationType
): boolean {
  const typeMap: Record<NotificationType, keyof typeof preferences> = {
    taskDueSoon: "taskDueSoon",
    taskOverdue: "taskOverdue",
    taskCompleted: "taskCompleted",
    newMessage: "newMessage",
    messageReply: "messageReply",
    locationOnline: "locationOnline",
    locationOffline: "locationOffline",
    locationStatusChange: "locationStatusChange",
    emergencyBroadcast: "emergencyBroadcast",
    regularBroadcast: "regularBroadcast",
    meetingStarted: "meetingStarted",
    meetingEnded: "meetingEnded",
    meetingReminder: "meetingReminder",
    newShoutout: "newShoutout",
    leaderboardUpdate: "leaderboardUpdate",
    systemAlert: "systemAlert",
    weeklyReport: "weeklyReport",
  };

  const preferenceField = typeMap[notificationType];
  if (!preferenceField) {
    return true; // Unknown type, allow by default
  }

  return preferences[preferenceField] === true;
}

/**
 * Get all notification types for a user based on their preferences
 */
export async function getUserNotificationTypes(
  userId: string,
  userType: "arl" | "admin" | "location"
): Promise<NotificationType[]> {
  try {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (!preferences) {
      return getDefaultNotificationTypes();
    }

    const enabledTypes: NotificationType[] = [];

    // Check each notification type
    if (preferences.taskDueSoon) enabledTypes.push("taskDueSoon");
    if (preferences.taskOverdue) enabledTypes.push("taskOverdue");
    if (preferences.taskCompleted) enabledTypes.push("taskCompleted");
    if (preferences.newMessage) enabledTypes.push("newMessage");
    if (preferences.messageReply) enabledTypes.push("messageReply");
    if (preferences.locationOnline) enabledTypes.push("locationOnline");
    if (preferences.locationOffline) enabledTypes.push("locationOffline");
    if (preferences.locationStatusChange) enabledTypes.push("locationStatusChange");
    if (preferences.emergencyBroadcast) enabledTypes.push("emergencyBroadcast");
    if (preferences.regularBroadcast) enabledTypes.push("regularBroadcast");
    if (preferences.meetingStarted) enabledTypes.push("meetingStarted");
    if (preferences.meetingEnded) enabledTypes.push("meetingEnded");
    if (preferences.meetingReminder) enabledTypes.push("meetingReminder");
    if (preferences.newShoutout) enabledTypes.push("newShoutout");
    if (preferences.leaderboardUpdate) enabledTypes.push("leaderboardUpdate");
    if (preferences.systemAlert) enabledTypes.push("systemAlert");
    if (preferences.weeklyReport) enabledTypes.push("weeklyReport");

    // Always include urgent notifications
    const priorityTypes = preferences.priorityTypes ? JSON.parse(preferences.priorityTypes) : [];
    if (priorityTypes.includes("urgent")) {
      enabledTypes.push("urgent");
    }

    return enabledTypes;
  } catch (error) {
    console.error("Error fetching user notification types:", error);
    return getDefaultNotificationTypes();
  }
}

/**
 * Get default notification types for a user
 */
function getDefaultNotificationTypes(): NotificationType[] {
  return [
    "taskDueSoon",
    "taskOverdue",
    "newMessage",
    "messageReply",
    "locationOnline",
    "emergencyBroadcast",
    "regularBroadcast",
    "meetingStarted",
    "meetingReminder",
    "newShoutout",
    "systemAlert",
  ];
}

// Type definition for notification types
export type NotificationType =
  | "taskDueSoon"
  | "taskOverdue"
  | "taskCompleted"
  | "newMessage"
  | "messageReply"
  | "locationOnline"
  | "locationOffline"
  | "locationStatusChange"
  | "emergencyBroadcast"
  | "regularBroadcast"
  | "meetingStarted"
  | "meetingEnded"
  | "meetingReminder"
  | "newShoutout"
  | "leaderboardUpdate"
  | "systemAlert"
  | "weeklyReport"
  | "urgent";
