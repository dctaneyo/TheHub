import type { GridLayout } from "./grid-engine";

// Widget catalog — used by the "add widget" menu and to label tiles.
export const WIDGET_CATALOG: {
  type: GridLayout["widgets"][number]["type"];
  title: string;
  defaultSize: GridLayout["widgets"][number]["size"];
}[] = [
  { type: "tasks", title: "Today's Tasks", defaultSize: "6x6" },
  { type: "calendar", title: "Upcoming", defaultSize: "4x6" },
  { type: "completed", title: "Completed & Missed", defaultSize: "4x6" },
  { type: "leaderboard", title: "Leaderboard", defaultSize: "4x6" },
  { type: "messages", title: "Messages", defaultSize: "4x3" },
  { type: "forms", title: "Forms", defaultSize: "4x3" },
  { type: "stats", title: "Overview", defaultSize: "12x3" },
];

export const PREDEFINED_LAYOUTS: GridLayout[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Tasks, calendar, leaderboard and quick actions",
    widgets: [
      { id: "tasks", type: "tasks", title: "Today's Tasks", size: "6x6", position: { x: 0, y: 0 } },
      { id: "calendar", type: "calendar", title: "Upcoming", size: "6x6", position: { x: 6, y: 0 } },
      { id: "leaderboard", type: "leaderboard", title: "Leaderboard", size: "4x6", position: { x: 0, y: 6 } },
      { id: "completed", type: "completed", title: "Completed & Missed", size: "4x6", position: { x: 4, y: 6 } },
      { id: "messages", type: "messages", title: "Messages", size: "4x3", position: { x: 8, y: 6 } },
      { id: "forms", type: "forms", title: "Forms", size: "4x3", position: { x: 8, y: 9 } },
    ],
  },
  {
    id: "focus",
    name: "Focus",
    description: "Big task list with supporting widgets",
    widgets: [
      { id: "stats", type: "stats", title: "Overview", size: "12x3", position: { x: 0, y: 0 } },
      { id: "tasks", type: "tasks", title: "Today's Tasks", size: "8x8", position: { x: 0, y: 3 } },
      { id: "calendar", type: "calendar", title: "Upcoming", size: "4x4", position: { x: 8, y: 3 } },
      { id: "messages", type: "messages", title: "Messages", size: "4x4", position: { x: 8, y: 7 } },
    ],
  },
  {
    id: "overview",
    name: "Overview",
    description: "Stats-first dashboard for a quick glance",
    widgets: [
      { id: "stats", type: "stats", title: "Overview", size: "12x3", position: { x: 0, y: 0 } },
      { id: "tasks", type: "tasks", title: "Today's Tasks", size: "6x6", position: { x: 0, y: 3 } },
      { id: "leaderboard", type: "leaderboard", title: "Leaderboard", size: "6x6", position: { x: 6, y: 3 } },
      { id: "completed", type: "completed", title: "Completed & Missed", size: "6x3", position: { x: 0, y: 9 } },
      { id: "calendar", type: "calendar", title: "Upcoming", size: "6x3", position: { x: 6, y: 9 } },
    ],
  },
];

export const DEFAULT_LAYOUT_ID = "balanced";

export function getPredefinedLayout(id: string): GridLayout | undefined {
  return PREDEFINED_LAYOUTS.find((l) => l.id === id);
}
