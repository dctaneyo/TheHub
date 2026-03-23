/**
 * Shared ARL view types and route-mapping utilities.
 *
 * This module is the single source of truth for the 15 ARL view IDs,
 * their corresponding route pathnames, and navigation helpers used by
 * the layout, sidebar, and context provider.
 */

export type ArlView =
  | "overview"
  | "messages"
  | "tasks"
  | "calendar"
  | "locations"
  | "forms"
  | "emergency"
  | "users"
  | "leaderboard"
  | "remote"
  | "data-management"
  | "broadcast"
  | "meetings"
  | "analytics"
  | "tenant-settings"
  | "war-room"
  | "challenges"
  | "mentorship";

/** Maps every ARL view ID to its route pathname. */
export const VIEW_ROUTE_MAP: Record<ArlView, string> = {
  overview: "/arl",
  messages: "/arl/messages",
  tasks: "/arl/tasks",
  calendar: "/arl/calendar",
  locations: "/arl/locations",
  forms: "/arl/forms",
  emergency: "/arl/emergency",
  users: "/arl/users",
  leaderboard: "/arl/leaderboard",
  remote: "/arl/remote",
  "data-management": "/arl/data-management",
  broadcast: "/arl/broadcast",
  meetings: "/arl/meetings",
  analytics: "/arl/analytics",
  "tenant-settings": "/arl/tenant-settings",
  "war-room": "/arl/war-room",
  challenges: "/arl/challenges",
  mentorship: "/arl/mentorship",
};

/**
 * Reverse lookup: pathname segment → view ID.
 * Built once at module load from VIEW_ROUTE_MAP.
 */
const SEGMENT_TO_VIEW: Record<string, ArlView> = Object.fromEntries(
  (Object.keys(VIEW_ROUTE_MAP) as ArlView[]).map((view) => {
    // "overview" maps to "" (the bare /arl route), everything else to its segment
    const segment = view === "overview" ? "" : VIEW_ROUTE_MAP[view].replace("/arl/", "");
    return [segment, view];
  }),
) as Record<string, ArlView>;

/**
 * Convert a pathname (e.g. "/arl/messages") to its ArlView ID.
 * Returns `"overview"` for unknown or empty segments.
 */
export function pathnameToViewId(pathname: string): ArlView {
  const segment = pathname.replace(/^\/arl\/?/, "").split("/")[0] || "";
  return SEGMENT_TO_VIEW[segment] ?? "overview";
}

/** Convert an ArlView ID to its route pathname. */
export function viewIdToPathname(view: ArlView): string {
  return VIEW_ROUTE_MAP[view];
}

/**
 * Determine the slide direction when navigating between two views.
 *
 * Returns `1` (forward / slide-left) when the destination appears later
 * in the navItems list, and `-1` (backward / slide-right) otherwise.
 *
 * Views not present in navItems are treated as having an index of -1,
 * so the comparison still produces a deterministic result.
 */
export function computeSlideDirection(
  from: ArlView,
  to: ArlView,
  navItems: { id: string }[],
): 1 | -1 {
  const fromIndex = navItems.findIndex((item) => item.id === from);
  const toIndex = navItems.findIndex((item) => item.id === to);
  return toIndex > fromIndex ? 1 : -1;
}
