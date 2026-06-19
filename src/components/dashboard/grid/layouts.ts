import type { GridLayout, WidgetType } from "./grid-engine";

// Widget catalog — used by the "add widget" menu and to label tiles.
export const WIDGET_CATALOG: {
  type: WidgetType;
  title: string;
  defaultW: number;
  defaultH: number;
}[] = [
  { type: "tasks", title: "Today's Tasks", defaultW: 6, defaultH: 6 },
  { type: "calendar", title: "Upcoming", defaultW: 4, defaultH: 6 },
  { type: "messages", title: "Messages", defaultW: 4, defaultH: 3 },
  { type: "forms", title: "Forms", defaultW: 4, defaultH: 3 },
  { type: "clock", title: "Clock", defaultW: 4, defaultH: 3 },
];

export const PREDEFINED_LAYOUTS: GridLayout[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Tasks, calendar and quick actions",
    widgets: [
      { id: "tasks", type: "tasks", title: "Today's Tasks", w: 6, h: 6, position: { x: 0, y: 0 } },
      { id: "calendar", type: "calendar", title: "Upcoming", w: 6, h: 6, position: { x: 6, y: 0 } },
      { id: "messages", type: "messages", title: "Messages", w: 3, h: 3, position: { x: 0, y: 6 } },
      { id: "forms", type: "forms", title: "Forms", w: 3, h: 3, position: { x: 3, y: 6 } },
    ],
  },
  {
    id: "focus",
    name: "Focus",
    description: "Big task list with clock and supporting widgets",
    widgets: [
      { id: "clock", type: "clock", title: "Clock", w: 4, h: 3, position: { x: 0, y: 0 } },
      { id: "tasks", type: "tasks", title: "Today's Tasks", w: 8, h: 9, position: { x: 4, y: 0 } },
      { id: "calendar", type: "calendar", title: "Upcoming", w: 4, h: 4, position: { x: 0, y: 3 } },
      { id: "messages", type: "messages", title: "Messages", w: 4, h: 2, position: { x: 0, y: 7 } },
    ],
  },
  {
    id: "overview",
    name: "Overview",
    description: "Clock-first dashboard for a quick glance",
    widgets: [
      { id: "clock", type: "clock", title: "Clock", w: 4, h: 3, position: { x: 0, y: 0 } },
      { id: "tasks", type: "tasks", title: "Today's Tasks", w: 8, h: 6, position: { x: 4, y: 0 } },
      { id: "messages", type: "messages", title: "Messages", w: 4, h: 3, position: { x: 0, y: 3 } },
      { id: "calendar", type: "calendar", title: "Upcoming", w: 8, h: 3, position: { x: 4, y: 6 } },
    ],
  },
];

export const DEFAULT_LAYOUT_ID = "balanced";

export function getPredefinedLayout(id: string): GridLayout | undefined {
  return PREDEFINED_LAYOUTS.find((l) => l.id === id);
}
