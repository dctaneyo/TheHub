import type { GridLayout, WidgetType } from "./grid-engine";

// Widget catalog — used by the "add widget" menu and to label tiles.
export const WIDGET_CATALOG: {
  type: WidgetType;
  title: string;
  defaultW: number;
  defaultH: number;
}[] = [
  { type: "tasks", title: "Today's Tasks", defaultW: 6, defaultH: 6 },
  { type: "calendar", title: "Upcoming 7 Days", defaultW: 4, defaultH: 6 },
  { type: "month", title: "Calendar", defaultW: 5, defaultH: 6 },
  { type: "messages", title: "Messages", defaultW: 4, defaultH: 3 },
  { type: "forms", title: "Forms", defaultW: 4, defaultH: 3 },
  { type: "clock", title: "Clock", defaultW: 4, defaultH: 3 },
  { type: "quote", title: "Daily Quote", defaultW: 4, defaultH: 2 },
];

// The one starting layout every location opens to until they customize it —
// not a choice among several presets. Clock-first for an at-a-glance status,
// Tasks dominant since that's the primary daily workflow, with Messages,
// Forms, and Quote stacked down the left column and Calendar filling the
// rest of the right column underneath Tasks. This is a complete, gapless
// tiling of the 12x12 grid (4x3 + 8x6 + 4x3 + 4x3 + 4x3 + 8x6 = 144 cells,
// exactly GRID_COLS*GRID_ROWS) rather than leaving rows empty at the bottom
// — a kiosk display should use the screen it has. "Reset dashboard to
// default" in the settings popover restores exactly this.
export const DEFAULT_LAYOUT: GridLayout = {
  id: "default",
  name: "Default",
  description: "Starting layout for a new location",
  widgets: [
    { id: "clock", type: "clock", title: "Clock", w: 4, h: 3, position: { x: 0, y: 0 } },
    { id: "tasks", type: "tasks", title: "Today's Tasks", w: 8, h: 6, position: { x: 4, y: 0 } },
    { id: "messages", type: "messages", title: "Messages", w: 4, h: 3, position: { x: 0, y: 3 } },
    { id: "forms", type: "forms", title: "Forms", w: 4, h: 3, position: { x: 0, y: 6 } },
    { id: "quote", type: "quote", title: "Daily Quote", w: 4, h: 3, position: { x: 0, y: 9 } },
    { id: "calendar", type: "calendar", title: "Upcoming", w: 8, h: 6, position: { x: 4, y: 6 } },
  ],
};
