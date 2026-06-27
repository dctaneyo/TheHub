export { GridSurface, GridSync, SettingsPanel, GridMirrorSync } from "./grid-dashboard";
export { GridProvider, useGrid } from "./grid-context";
export {
  PREDEFINED_LAYOUTS,
  WIDGET_CATALOG,
  DEFAULT_LAYOUT_ID,
  getPredefinedLayout,
} from "./layouts";
export {
  GRID_COLS,
  GRID_ROWS,
  MIN_W,
  MIN_H,
  CUSTOM_LAYOUT_ID,
  normalizeLayout,
  normalizeWidget,
  type Widget,
  type WidgetType,
  type GridLayout,
} from "./grid-engine";
export type { WidgetData, UpcomingTask } from "./widget-data";
