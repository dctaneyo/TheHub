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
export function broadcastTaskUpdate(locationId?: string | null) {
  if (!isAvailable()) return;
  // Notify all locations to refresh tasks (or a specific one)
  if (locationId) {
    emitToLocation(locationId, "task:updated", { locationId });
  } else {
    emitToLocations("task:updated", {});
  }
  // Also notify ARLs so their task manager / overview refreshes
  emitToArls("task:updated", { locationId });
}

export function broadcastTaskCompleted(locationId: string, taskId: string, taskTitle: string, pointsEarned: number) {
  if (!isAvailable()) return;
  emitToArls("task:completed", { locationId, taskId, taskTitle, pointsEarned });
  emitToLocation(locationId, "task:updated", { locationId });
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
export function broadcastEmergency(data: { id: string; message: string; sentByName: string; targetLocationIds?: string[] | null }) {
  if (!isAvailable()) return;
  if (data.targetLocationIds && data.targetLocationIds.length > 0) {
    for (const locId of data.targetLocationIds) {
      emitToLocation(locId, "emergency:broadcast", data);
    }
  } else {
    emitToLocations("emergency:broadcast", data);
  }
  emitToArls("emergency:updated", data);
}

export function broadcastEmergencyDismissed() {
  if (!isAvailable()) return;
  emitToAll("emergency:dismissed", {});
}

export function broadcastEmergencyViewed(messageId: string, locationId: string, locationName: string) {
  if (!isAvailable()) return;
  emitToArls("emergency:viewed", { messageId, locationId, locationName });
}

// ── Presence events ──
export function broadcastPresenceUpdate(userId: string, userType: string, name: string, isOnline: boolean, storeNumber?: string) {
  if (!isAvailable()) return;
  emitToArls("presence:update", { userId, userType, name, isOnline, storeNumber });
}

// ── Remote login / pending session events ──
export function broadcastPendingSession(data: { id: string; code: string; userAgent: string; createdAt: string; expiresAt: string }) {
  if (!isAvailable()) return;
  emitToArls("session:pending", data);
}

export function broadcastSessionActivated(pendingId: string) {
  if (!isAvailable()) return;
  // Tell the login page watcher that their session was activated
  emitToLoginWatchers("session:activated", { pendingId });
  // Also tell ARLs to refresh pending sessions list
  emitToArls("session:pending:refresh", {});
}

export function broadcastPing(pendingId: string) {
  if (!isAvailable()) return;
  emitToLoginWatchers("session:ping", { pendingId });
}

// ── Read receipts ──
export function broadcastMessageRead(conversationId: string, readerId: string) {
  if (!isAvailable()) return;
  emitToConversation(conversationId, "message:read", { conversationId, readerId });
}

// ── Leaderboard / gamification events ──
export function broadcastLeaderboardUpdate(locationId: string) {
  if (!isAvailable()) return;
  emitToAll("leaderboard:updated", { locationId });
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
