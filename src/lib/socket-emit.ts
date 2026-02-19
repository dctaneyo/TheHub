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
export function broadcastNewMessage(conversationId: string, message: {
  id: string;
  senderId: string;
  senderName: string;
  senderType: string;
  content: string;
  createdAt: string;
}) {
  if (!isAvailable()) return;
  emitToConversation(conversationId, "message:new", { conversationId, ...message });
}

export function broadcastConversationUpdate(conversationId: string) {
  if (!isAvailable()) return;
  // Tell everyone in the conversation to refresh their conversation list
  emitToConversation(conversationId, "conversation:updated", { conversationId });
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
