export { GridSurface, GridSync, SettingsPanel, GridMirrorSync } from "./grid-dashboard";
export { GridProvider, useGrid } from "./grid-context";
export { DEFAULT_LAYOUT, WIDGET_CATALOG } from "./layouts";
export {
  GRID_COLS,
  GRID_ROWS,
  MIN_W,
  MIN_H,
  normalizeLayout,
  normalizeWidget,
  type Widget,
  type WidgetType,
  type GridLayout,
} from "./grid-engine";
export type { WidgetData, UpcomingTask } from "./widget-data";
