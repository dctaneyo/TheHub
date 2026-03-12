import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { notificationPreferences, type NotificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/preferences/notifications
 * Fetch notification preferences for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const preferences = await db
      .select()
      .from(notificationPreferences)
      .where(
        eq(notificationPreferences.userId, session.id)
      )
      .limit(1);

    if (preferences.length === 0) {
      // Return default preferences if none exist
      const defaults = getDefaultPreferences(session.userType);
      return NextResponse.json(defaults);
    }

    const prefs = preferences[0];
    return NextResponse.json({
      id: prefs.id,
      userId: prefs.userId,
      userType: prefs.userType,
      tenantId: prefs.tenantId,
      taskDueSoon: prefs.taskDueSoon,
      taskOverdue: prefs.taskOverdue,
      taskCompleted: prefs.taskCompleted,
      newMessage: prefs.newMessage,
      messageReply: prefs.messageReply,
      locationOnline: prefs.locationOnline,
      locationOffline: prefs.locationOffline,
      locationStatusChange: prefs.locationStatusChange,
      emergencyBroadcast: prefs.emergencyBroadcast,
      regularBroadcast: prefs.regularBroadcast,
      meetingStarted: prefs.meetingStarted,
      meetingEnded: prefs.meetingEnded,
      meetingReminder: prefs.meetingReminder,
      newShoutout: prefs.newShoutout,
      leaderboardUpdate: prefs.leaderboardUpdate,
      systemAlert: prefs.systemAlert,
      weeklyReport: prefs.weeklyReport,
      priorityTypes: prefs.priorityTypes ? JSON.parse(prefs.priorityTypes) : [],
      emailNotifications: prefs.emailNotifications,
      pushNotifications: prefs.pushNotifications,
      inAppNotifications: prefs.inAppNotifications,
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/preferences/notifications
 * Update notification preferences for the current user
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await req.json();
    
    // Validate and extract preference fields
    const validFields = [
      "taskDueSoon", "taskOverdue", "taskCompleted",
      "newMessage", "messageReply",
      "locationOnline", "locationOffline", "locationStatusChange",
      "emergencyBroadcast", "regularBroadcast",
      "meetingStarted", "meetingEnded", "meetingReminder",
      "newShoutout", "leaderboardUpdate",
      "systemAlert", "weeklyReport",
      "priorityTypes",
      "emailNotifications", "pushNotifications", "inAppNotifications"
    ];

    const updates: Partial<NotificationPreferences> = {
      updatedAt: new Date().toISOString(),
    };

    for (const field of validFields) {
      if (body[field] !== undefined) {
        if (field === "priorityTypes") {
          // Validate priorityTypes is an array of strings
          if (!Array.isArray(body[field])) {
            return NextResponse.json({ error: "priorityTypes must be an array" }, { status: 400 });
          }
          updates[field] = JSON.stringify(body[field]);
        } else {
          // Boolean fields
          updates[field] = body[field] === true || body[field] === false ? body[field] : false;
        }
      }
    }

    if (Object.keys(updates).length === 1) {
      // No valid fields to update
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Check if preferences exist
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.id))
      .limit(1);

    if (existing.length > 0) {
      // Update existing preferences
      await db
        .update(notificationPreferences)
        .set(updates)
        .where(eq(notificationPreferences.id, existing[0].id));
      
      updates.id = existing[0].id;
    } else {
      // Create new preferences with defaults
      const defaults = getDefaultPreferences(session.userType);
      await db.insert(notificationPreferences).values({
        id: crypto.randomUUID(),
        userId: session.id,
        userType: session.userType as "arl" | "admin" | "location",
        tenantId: session.tenantId || "kazi",
        ...defaults,
        ...updates,
      });
    }

    // Fetch and return updated preferences
    const [updatedPrefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      preferences: {
        id: updatedPrefs.id,
        userId: updatedPrefs.userId,
        userType: updatedPrefs.userType,
        tenantId: updatedPrefs.tenantId,
        taskDueSoon: updatedPrefs.taskDueSoon,
        taskOverdue: updatedPrefs.taskOverdue,
        taskCompleted: updatedPrefs.taskCompleted,
        newMessage: updatedPrefs.newMessage,
        messageReply: updatedPrefs.messageReply,
        locationOnline: updatedPrefs.locationOnline,
        locationOffline: updatedPrefs.locationOffline,
        locationStatusChange: updatedPrefs.locationStatusChange,
        emergencyBroadcast: updatedPrefs.emergencyBroadcast,
        regularBroadcast: updatedPrefs.regularBroadcast,
        meetingStarted: updatedPrefs.meetingStarted,
        meetingEnded: updatedPrefs.meetingEnded,
        meetingReminder: updatedPrefs.meetingReminder,
        newShoutout: updatedPrefs.newShoutout,
        leaderboardUpdate: updatedPrefs.leaderboardUpdate,
        systemAlert: updatedPrefs.systemAlert,
        weeklyReport: updatedPrefs.weeklyReport,
        priorityTypes: updatedPrefs.priorityTypes ? JSON.parse(updatedPrefs.priorityTypes) : [],
        emailNotifications: updatedPrefs.emailNotifications,
        pushNotifications: updatedPrefs.pushNotifications,
        inAppNotifications: updatedPrefs.inAppNotifications,
      },
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper function to get default preferences based on user type
function getDefaultPreferences(userType: string): Partial<NotificationPreferences> {
  const baseDefaults = {
    taskDueSoon: true,
    taskOverdue: true,
    taskCompleted: false,
    newMessage: true,
    messageReply: true,
    locationOnline: true,
    locationOffline: false,
    locationStatusChange: false,
    emergencyBroadcast: true,
    regularBroadcast: true,
    meetingStarted: true,
    meetingEnded: false,
    meetingReminder: true,
    newShoutout: true,
    leaderboardUpdate: false,
    systemAlert: true,
    weeklyReport: false,
    priorityTypes: JSON.stringify(["urgent"]),
    emailNotifications: false,
    pushNotifications: true,
    inAppNotifications: true,
  };

  // Admins get slightly different defaults (more notifications)
  if (userType === "admin") {
    return {
      ...baseDefaults,
      taskCompleted: true,
      locationOffline: true,
      locationStatusChange: true,
      meetingEnded: true,
      leaderboardUpdate: true,
    };
  }

  return baseDefaults;
}
