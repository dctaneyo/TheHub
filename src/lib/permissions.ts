/**
 * ARL Permission System
 *
 * Admins have ALL permissions and cannot be revoked.
 * New ARLs default to ALL permissions enabled.
 * Permissions can be individually toggled per ARL.
 */

// ── Permission keys ──
export const PERMISSIONS = {
  // Users — Locations
  LOCATIONS_CREATE: "locations.create",
  LOCATIONS_DELETE: "locations.delete",
  LOCATIONS_EDIT: "locations.edit",

  // Users — ARLs
  ARLS_CREATE: "arls.create",
  ARLS_DELETE: "arls.delete",
  ARLS_EDIT: "arls.edit",

  // Tasks & Reminders
  TASKS_CREATE: "tasks.create",
  TASKS_DELETE: "tasks.delete",
  TASKS_EDIT: "tasks.edit",

  // Locations management
  LOCATIONS_MUTE: "locations.mute",
  LOCATIONS_RESET_PIN: "locations.reset_pin",

  // Meetings
  MEETINGS_START: "meetings.start",
  MEETINGS_SCHEDULE: "meetings.schedule",
  MEETINGS_DELETE: "meetings.delete",
  MEETINGS_EDIT: "meetings.edit",

  // Emergency Broadcast
  EMERGENCY_ACCESS: "emergency.access",

  // Data Management
  DATA_MANAGEMENT_ACCESS: "data_management.access",

  // Forms Repository
  FORMS_UPLOAD: "forms.upload",
  FORMS_DELETE: "forms.delete",

  // Ticker
  TICKER_CREATE: "ticker.create",
  TICKER_DELETE: "ticker.delete",

  // Analytics
  ANALYTICS_ACCESS: "analytics.access",

  // Gamification (shoutouts, high-fives)
  GAMIFICATION_SEND: "gamification.send",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ── All permission keys as an array (used for defaults) ──
export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

// ── Permission groups for the UI ──
export interface PermissionGroup {
  label: string;
  description: string;
  permissions: { key: PermissionKey; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Users — Locations",
    description: "Manage restaurant/location accounts",
    permissions: [
      { key: PERMISSIONS.LOCATIONS_CREATE, label: "Create locations" },
      { key: PERMISSIONS.LOCATIONS_DELETE, label: "Delete locations" },
      { key: PERMISSIONS.LOCATIONS_EDIT, label: "Edit locations" },
    ],
  },
  {
    label: "Users — ARLs",
    description: "Manage ARL accounts",
    permissions: [
      { key: PERMISSIONS.ARLS_CREATE, label: "Create ARLs" },
      { key: PERMISSIONS.ARLS_DELETE, label: "Delete ARLs" },
      { key: PERMISSIONS.ARLS_EDIT, label: "Edit ARLs" },
    ],
  },
  {
    label: "Tasks & Reminders",
    description: "Create and manage tasks/reminders",
    permissions: [
      { key: PERMISSIONS.TASKS_CREATE, label: "Create tasks" },
      { key: PERMISSIONS.TASKS_DELETE, label: "Delete tasks" },
      { key: PERMISSIONS.TASKS_EDIT, label: "Edit tasks" },
    ],
  },
  {
    label: "Locations",
    description: "Location-level management actions",
    permissions: [
      { key: PERMISSIONS.LOCATIONS_MUTE, label: "Mute/unmute notifications" },
      { key: PERMISSIONS.LOCATIONS_RESET_PIN, label: "Reset PIN" },
    ],
  },
  {
    label: "Meetings",
    description: "Video meetings and scheduling",
    permissions: [
      { key: PERMISSIONS.MEETINGS_START, label: "Start meeting" },
      { key: PERMISSIONS.MEETINGS_SCHEDULE, label: "Schedule meeting" },
      { key: PERMISSIONS.MEETINGS_DELETE, label: "Delete meeting" },
      { key: PERMISSIONS.MEETINGS_EDIT, label: "Edit meeting" },
    ],
  },
  {
    label: "Emergency Broadcast",
    description: "Send emergency messages to all locations",
    permissions: [
      { key: PERMISSIONS.EMERGENCY_ACCESS, label: "Access" },
    ],
  },
  {
    label: "Data Management",
    description: "Bulk operations, import/export",
    permissions: [
      { key: PERMISSIONS.DATA_MANAGEMENT_ACCESS, label: "Access" },
    ],
  },
  {
    label: "Forms Repository",
    description: "Upload and manage form PDFs",
    permissions: [
      { key: PERMISSIONS.FORMS_UPLOAD, label: "Upload forms" },
      { key: PERMISSIONS.FORMS_DELETE, label: "Delete forms" },
    ],
  },
  {
    label: "Live Ticker",
    description: "Push messages to the live ticker",
    permissions: [
      { key: PERMISSIONS.TICKER_CREATE, label: "Create messages" },
      { key: PERMISSIONS.TICKER_DELETE, label: "Delete messages" },
    ],
  },
  {
    label: "Analytics",
    description: "View analytics dashboard",
    permissions: [
      { key: PERMISSIONS.ANALYTICS_ACCESS, label: "Access" },
    ],
  },
  {
    label: "Gamification",
    description: "Shoutouts and high-fives",
    permissions: [
      { key: PERMISSIONS.GAMIFICATION_SEND, label: "Send shoutouts & high-fives" },
    ],
  },
];

// ── Helpers ──

/**
 * Parse the permissions JSON column from the DB.
 * Returns null (= all permissions) or a string array of enabled permission keys.
 */
export function parsePermissions(raw: string | null | undefined): PermissionKey[] | null {
  if (!raw) return null; // null means "all permissions" (default/admin)
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as PermissionKey[];
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a user has a specific permission.
 * - Admins always return true.
 * - If permissions is null (not set), all permissions granted (default for new ARLs).
 * - Otherwise, check if the key is in the array.
 */
export function hasPermission(
  role: string | undefined,
  permissions: PermissionKey[] | null,
  key: PermissionKey
): boolean {
  if (role === "admin") return true;
  if (permissions === null) return true; // default = all
  return permissions.includes(key);
}

/**
 * Map ARL sidebar view IDs to the permission required to see them.
 * Views not listed here are always visible (overview, messages, calendar, leaderboard).
 */
export const VIEW_PERMISSIONS: Record<string, PermissionKey> = {
  emergency: PERMISSIONS.EMERGENCY_ACCESS,
  "data-management": PERMISSIONS.DATA_MANAGEMENT_ACCESS,
  analytics: PERMISSIONS.ANALYTICS_ACCESS,
};
