"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ---- Grid configuration -----------------------------------------------------

export const GRID_COLS = 12;
export const GRID_ROWS = 12;

// Widget size presets (width x height in grid cells)
export const WIDGET_SIZES = {
  "2x2": { width: 2, height: 2 },
  "3x3": { width: 3, height: 3 },
  "4x3": { width: 4, height: 3 },
  "4x4": { width: 4, height: 4 },
  "4x6": { width: 4, height: 6 },
  "4x8": { width: 4, height: 8 },
  "6x3": { width: 6, height: 3 },
  "6x4": { width: 6, height: 4 },
  "6x6": { width: 6, height: 6 },
  "8x4": { width: 8, height: 4 },
  "8x6": { width: 8, height: 6 },
  "8x8": { width: 8, height: 8 },
  "12x3": { width: 12, height: 3 },
  "12x4": { width: 12, height: 4 },
  "12x6": { width: 12, height: 6 },
} as const;

export type WidgetSize = keyof typeof WIDGET_SIZES;

// Widget types map 1:1 to renderable dashboard components.
export type WidgetType =
  | "tasks"
  | "calendar"
  | "completed"
  | "leaderboard"
  | "messages"
  | "forms"
  | "stats";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: { x: number; y: number };
}

export interface GridLayout {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  isCustom?: boolean;
}

// ---- Collision helpers ------------------------------------------------------

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boundsOf(widget: Pick<Widget, "position" | "size">): Bounds {
  const { width, height } = WIDGET_SIZES[widget.size];
  return {
    left: widget.position.x,
    top: widget.position.y,
    right: widget.position.x + width,
    bottom: widget.position.y + height,
  };
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

/** True if `candidate` collides with any widget except `excludeId`. */
export function checkCollision(
  candidate: Pick<Widget, "position" | "size">,
  others: Widget[],
  excludeId?: string
): boolean {
  const cb = boundsOf(candidate);
  return others.some((o) => o.id !== excludeId && overlaps(cb, boundsOf(o)));
}

/** True if a widget of `size` placed at (x,y) is on-grid and collision-free. */
export function fits(
  size: WidgetSize,
  position: { x: number; y: number },
  others: Widget[],
  excludeId?: string
): boolean {
  const { width, height } = WIDGET_SIZES[size];
  if (position.x < 0 || position.y < 0) return false;
  if (position.x + width > GRID_COLS) return false;
  if (position.y + height > GRID_ROWS) return false;
  return !checkCollision({ position, size }, others, excludeId);
}

/** Scan row-by-row for the first empty slot that fits `size`. */
export function findEmptyPosition(
  size: WidgetSize,
  widgets: Widget[],
  excludeId?: string
): { x: number; y: number } | null {
  const { width, height } = WIDGET_SIZES[size];
  for (let y = 0; y <= GRID_ROWS - height; y++) {
    for (let x = 0; x <= GRID_COLS - width; x++) {
      if (fits(size, { x, y }, widgets, excludeId)) return { x, y };
    }
  }
  return null;
}

// ---- Layout engine hook -----------------------------------------------------

export function useGridLayout(initialLayout: GridLayout) {
  const [layout, setLayout] = useState<GridLayout>(initialLayout);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);

  // Keep internal layout in sync if the caller swaps the initial layout
  // (e.g. after loading a persisted layout asynchronously).
  const initialIdRef = useRef(initialLayout.id);
  useEffect(() => {
    if (initialLayout.id !== initialIdRef.current) {
      initialIdRef.current = initialLayout.id;
      setLayout(initialLayout);
      setExpandedWidget(null);
    }
  }, [initialLayout]);

  const markCustom = (l: GridLayout): GridLayout => ({
    ...l,
    isCustom: true,
  });

  /** Move a widget only if the target slot is valid (no overlap, on-grid). */
  const moveWidget = useCallback(
    (widgetId: string, position: { x: number; y: number }) => {
      setLayout((prev) => {
        const widget = prev.widgets.find((w) => w.id === widgetId);
        if (!widget) return prev;
        if (!fits(widget.size, position, prev.widgets, widgetId)) return prev;
        return markCustom({
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === widgetId ? { ...w, position } : w
          ),
        });
      });
    },
    []
  );

  const resizeWidget = useCallback((widgetId: string, size: WidgetSize) => {
    setLayout((prev) => {
      const widget = prev.widgets.find((w) => w.id === widgetId);
      if (!widget) return prev;

      // Keep current position if the new size fits there.
      if (fits(size, widget.position, prev.widgets, widgetId)) {
        return markCustom({
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === widgetId ? { ...w, size } : w
          ),
        });
      }
      // Otherwise relocate to the first slot that fits.
      const pos = findEmptyPosition(
        size,
        prev.widgets.filter((w) => w.id !== widgetId)
      );
      if (!pos) return prev;
      return markCustom({
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === widgetId ? { ...w, size, position: pos } : w
        ),
      });
    });
  }, []);

  const toggleExpand = useCallback((widgetId: string) => {
    setExpandedWidget((prev) => (prev === widgetId ? null : widgetId));
  }, []);

  const addWidget = useCallback((widget: Omit<Widget, "position">) => {
    setLayout((prev) => {
      const pos = findEmptyPosition(widget.size, prev.widgets);
      if (!pos) return prev;
      return markCustom({
        ...prev,
        widgets: [...prev.widgets, { ...widget, position: pos }],
      });
    });
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) =>
      markCustom({
        ...prev,
        widgets: prev.widgets.filter((w) => w.id !== widgetId),
      })
    );
    setExpandedWidget((prev) => (prev === widgetId ? null : prev));
  }, []);

  const replaceLayout = useCallback((next: GridLayout) => {
    setLayout(next);
    setExpandedWidget(null);
  }, []);

  return useMemo(
    () => ({
      layout,
      widgets: layout.widgets,
      expandedWidget,
      isExpanded: (id: string) => expandedWidget === id,
      moveWidget,
      resizeWidget,
      toggleExpand,
      addWidget,
      removeWidget,
      replaceLayout,
    }),
    [
      layout,
      expandedWidget,
      moveWidget,
      resizeWidget,
      toggleExpand,
      addWidget,
      removeWidget,
      replaceLayout,
    ]
  );
}
