import type { ActiveMeeting, MeetingAnalyticsData, ForceAction, RemoteViewSession } from "./types";
import type { ActiveBroadcastState } from "./broadcasts";

/**
 * Global singleton state stored on globalThis so it survives HMR and
 * is shared between the custom Node server and webpack-bundled API routes.
 */

const _g = globalThis as any;

// ── Active meetings ──
if (!_g.__hubActiveMeetings) {
  _g.__hubActiveMeetings = new Map<string, ActiveMeeting>();
}
export const activeMeetings: Map<string, ActiveMeeting> = _g.__hubActiveMeetings;

// ── Meeting analytics ──
if (!_g.__hubMeetingAnalytics) {
  _g.__hubMeetingAnalytics = new Map<string, MeetingAnalyticsData>();
}
export const meetingAnalytics: Map<string, MeetingAnalyticsData> = _g.__hubMeetingAnalytics;

// ── Host-leave auto-end timers ──
if (!_g.__hubHostLeftTimers) {
  _g.__hubHostLeftTimers = new Map<string, ReturnType<typeof setTimeout>>();
}
export const hostLeftTimers: Map<string, ReturnType<typeof setTimeout>> = _g.__hubHostLeftTimers;

// ── Disconnect grace period timers ──
if (!_g.__hubDisconnectTimers) {
  _g.__hubDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
}
export const disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = _g.__hubDisconnectTimers;

// ── Per-location task notification timers ──
if (!_g.__hubTaskTimers) {
  _g.__hubTaskTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
}
export const taskTimers: Map<string, ReturnType<typeof setTimeout>[]> = _g.__hubTaskTimers;

// ── Pending force actions ──
if (!_g.__hubPendingForceActions) {
  _g.__hubPendingForceActions = new Map<string, ForceAction>();
}
export const pendingForceActions: Map<string, ForceAction> = _g.__hubPendingForceActions;

// ── Active remote view sessions ──
if (!_g.__hubRemoteViewSessions) {
  _g.__hubRemoteViewSessions = new Map<string, RemoteViewSession>();
}
export const remoteViewSessions: Map<string, RemoteViewSession> = _g.__hubRemoteViewSessions;

// ── Remote view disconnect grace timers ──
if (!_g.__hubRvDisconnectTimers) {
  _g.__hubRvDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
}
export const rvDisconnectTimers: Map<string, ReturnType<typeof setTimeout>> = _g.__hubRvDisconnectTimers;

// ── Active broadcasts ──
if (!_g.__hubActiveBroadcasts) {
  _g.__hubActiveBroadcasts = new Map<string, ActiveBroadcastState>();
}
export const activeBroadcasts: Map<string, ActiveBroadcastState> = _g.__hubActiveBroadcasts;

// ── Constants ──
export const HOST_LEFT_AUTO_END_MS = 10 * 60 * 1000; // 10 minutes
export const HOST_LEFT_WARNING_INTERVALS = [5 * 60, 2 * 60, 60, 30, 10]; // seconds remaining
export const DISCONNECT_GRACE_MS = 20_000; // 20 seconds
export const RV_DISCONNECT_GRACE_MS = 15_000; // 15 seconds for remote view reconnection
