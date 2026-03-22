// Thin wrapper for API routes to emit socket events.
// In production (custom server), getIO() returns the live Socket.io instance.
// During `next build` or if socket isn't initialized, calls are silently no-ops.

import {
  emitToAll,
  emitToLocations,
  emitToArls,
  emitToLocation,
  emitToArl,
  emitToConversation,
  emitToLoginWatchers,
  getIO,
} from "./socket-server";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

function isAvailable(): boolean {
  return getIO() !== null;
}

// ── Task events ──
export function broadcastTaskUpdate(locationId?: string | null, tenantId?: string) {
  if (!isAvailable()) return;
  // Notify all locations to refresh tasks (or a specific one)
  if (locationId) {
    emitToLocation(locationId, "task:updated", { locationId }, tenantId);
  } else {
    emitToLocations("task:updated", {}, tenantId);
  }
  // Also notify ARLs so their task manager / overview refreshes
  emitToArls("task:updated", { locationId }, tenantId);
}

export function broadcastTaskCompleted(locationId: string, taskId: string, taskTitle: string, pointsEarned: number, locationName?: string, tenantId?: string) {
  if (!isAvailable()) return;
  const payload = { locationId, taskId, taskTitle, pointsEarned, locationName: locationName || "A location" };
  emitToArls("task:completed", payload, tenantId);
  emitToLocations("task:completed", payload, tenantId);
  emitToLocation(locationId, "task:updated", { locationId }, tenantId);
}

export function broadcastTaskUncompleted(locationId: string, taskId: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToArls("task:uncompleted", { locationId, taskId }, tenantId);
  emitToLocations("task:uncompleted", { locationId, taskId }, tenantId);
}

// ── Message events ──

// Helper: emit to all members of a conversation via their user rooms
// (not just the conversation room, which users only join when viewing it)
function emitToConversationMembers(conversationId: string, event: string, data: any) {
  const io = getIO();
  if (!io) return;
  // Always emit to the conversation room (for users actively viewing it)
  emitToConversation(conversationId, event, data);
  // Also emit to each member's user room so they get notified even on the conversation list
  try {
    const members = db.select().from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, conversationId))
      .all();
    for (const m of members) {
      if (m.memberType === "location") {
        emitToLocation(m.memberId, event, data);
      } else {
        emitToArl(m.memberId, event, data);
      }
    }
  } catch (err) {
    console.error("emitToConversationMembers DB lookup failed:", err);
  }
}

export function broadcastNewMessage(conversationId: string, message: {
  id: string;
  senderId: string;
  senderName: string;
  senderType: string;
  content: string;
  createdAt: string;
}) {
  if (!isAvailable()) return;
  emitToConversationMembers(conversationId, "message:new", { conversationId, ...message });
}

export function broadcastConversationUpdate(conversationId: string) {
  if (!isAvailable()) return;
  emitToConversationMembers(conversationId, "conversation:updated", { conversationId });
}

// ── Emergency events ──
export function broadcastEmergency(data: { id: string; message: string; sentByName: string; targetLocationIds?: string[] | null }, tenantId?: string) {
  if (!isAvailable()) return;
  if (data.targetLocationIds && data.targetLocationIds.length > 0) {
    for (const locId of data.targetLocationIds) {
      emitToLocation(locId, "emergency:broadcast", data, tenantId);
    }
  } else {
    emitToLocations("emergency:broadcast", data, tenantId);
  }
  emitToArls("emergency:updated", data, tenantId);
}

export function broadcastEmergencyDismissed(tenantId?: string) {
  if (!isAvailable()) return;
  emitToAll("emergency:dismissed", {}, tenantId);
}

export function broadcastEmergencyViewed(messageId: string, locationId: string, locationName: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToArls("emergency:viewed", { messageId, locationId, locationName }, tenantId);
}

export function broadcastEmergencyViewedLocal(locationId: string, messageId: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToLocation(locationId, "emergency:viewed-local", { messageId }, tenantId);
}

// ── Presence events ──
export function broadcastPresenceUpdate(userId: string, userType: string, name: string, isOnline: boolean, storeNumber?: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToArls("presence:update", { userId, userType, name, isOnline, storeNumber }, tenantId);
}

// Notify a specific user's connected sockets that their session list changed
// so ConnectionStatus can re-fetch /api/session/code and stay live.
export function broadcastSessionUpdated(userId: string, userType: string) {
  if (!isAvailable()) return;
  const room = userType === "location" ? `location:${userId}` : `arl:${userId}`;
  getIO()!.to(room).emit("session:updated", {});
}

// ── Remote login / pending session events ──
export function broadcastPendingSession(data: { id: string; code: string; userAgent: string; createdAt: string; expiresAt: string }, tenantId?: string) {
  if (!isAvailable()) return;
  emitToArls("session:pending", data, tenantId);
}

export function broadcastSessionActivated(pendingId: string, tenantId?: string) {
  if (!isAvailable()) return;
  // Tell the login page watcher that their session was activated
  emitToLoginWatchers("session:activated", { pendingId });
  // Also tell ARLs to refresh pending sessions list
  emitToArls("session:pending:refresh", {}, tenantId);
}

export function broadcastPendingSessionCancelled(pendingId: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToArls("session:pending:cancelled", { pendingId }, tenantId);
}

export function broadcastPing(pendingId: string) {
  if (!isAvailable()) return;
  emitToLoginWatchers("session:ping", { pendingId });
}

// ── Notification dismiss sync (multi-kiosk) ──
export function broadcastNotificationDismissed(locationId: string, notificationIds: string[], tenantId?: string) {
  if (!isAvailable()) return;
  emitToLocation(locationId, "notification:dismissed", { notificationIds }, tenantId);
}

// ── Sound mute toggle ──
export function broadcastSoundToggle(locationId: string, muted: boolean, tenantId?: string) {
  if (!isAvailable()) return;
  emitToLocation(locationId, "location:sound-toggle", { muted }, tenantId);
  emitToArls("location:sound-toggle", { locationId, muted }, tenantId);
}

// ── Read receipts ──
export function broadcastMessageRead(conversationId: string, readerId: string) {
  if (!isAvailable()) return;
  emitToConversation(conversationId, "message:read", { conversationId, readerId });
}

// ── User / location management events ──
export function broadcastUserUpdate(tenantId?: string) {
  if (!isAvailable()) return;
  emitToArls("user:updated", {}, tenantId);
}

// ── Leaderboard / gamification events ──
export function broadcastLeaderboardUpdate(locationId: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToAll("leaderboard:updated", { locationId }, tenantId);
}

// ── Force session management ──
export function broadcastForceLogout(userId: string, userType: string) {
  if (!isAvailable()) return;
  if (userType === "location") {
    emitToLocation(userId, "session:force-logout", {});
  } else {
    emitToArl(userId, "session:force-logout", {});
  }
}

export function broadcastForceRedirect(userId: string, userType: string, token: string, redirectTo: string) {
  if (!isAvailable()) return;
  if (userType === "location") {
    emitToLocation(userId, "session:force-redirect", { token, redirectTo });
  } else {
    emitToArl(userId, "session:force-redirect", { token, redirectTo });
  }
}

// ── General broadcast to all connected users ──
export function broadcastToAll(event: string, data: any) {
  if (!isAvailable()) return;
  emitToAll(event, data);
}

// Old broadcast stream functions removed — meeting system handles real-time via socket events directly.

// ── Ticker message events ──
export function emitTickerMessage(msg: { id: string; content: string; icon: string; arlName: string; expiresAt: string | null; createdAt: string }, tenantId?: string) {
  if (!isAvailable()) return;
  emitToLocations("ticker:new", msg, tenantId);
}

export function emitTickerDelete(id: string, tenantId?: string) {
  if (!isAvailable()) return;
  emitToLocations("ticker:delete", { id }, tenantId);
}

// ── Notification events ──
export function broadcastNotification(userId: string, notification: any, counts: { total: number; unread: number; urgent: number }) {
  if (!isAvailable()) return;
  const io = getIO();
  if (!io) return;
  
  // Emit to user's notification room
  io.to(`notifications:${userId}`).emit("notification:new", {
    notification,
    count: counts,
  });
}

export function broadcastNotificationRead(userId: string) {
  if (!isAvailable()) return;
  const io = getIO();
  if (!io) return;
  
  io.to(`notifications:${userId}`).emit("notification:read", {});
}

export function broadcastNotificationDeleted(userId: string) {
  if (!isAvailable()) return;
  const io = getIO();
  if (!io) return;
  
  io.to(`notifications:${userId}`).emit("notification:deleted", {});
}
