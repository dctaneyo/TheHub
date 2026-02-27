import type { ActiveMeeting, MeetingAnalyticsData, ForceAction } from "./types";

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

// ── Constants ──
export const HOST_LEFT_AUTO_END_MS = 10 * 60 * 1000; // 10 minutes
export const HOST_LEFT_WARNING_INTERVALS = [5 * 60, 2 * 60, 60, 30, 10]; // seconds remaining
export const DISCONNECT_GRACE_MS = 20_000; // 20 seconds
