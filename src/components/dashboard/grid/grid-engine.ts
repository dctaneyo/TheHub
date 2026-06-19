"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ---- Grid configuration -----------------------------------------------------

export const GRID_COLS = 12;
export const GRID_ROWS = 12;

// Minimum widget footprint (in grid cells). Widgets can be resized freely
// between this minimum and the full grid, in single-cell increments.
export const MIN_W = 2;
export const MIN_H = 2;

// Legacy preset table — kept ONLY to migrate older persisted layouts that
// stored a `size` string (e.g. "4x6") instead of explicit w/h numbers.
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
  | "messages"
  | "forms"
  | "clock";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  // Free-form footprint in grid cells (no longer constrained to presets).
  w: number;
  h: number;
  position: { x: number; y: number };
}

export interface GridLayout {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  isCustom?: boolean;
}

// Identity of the single user-editable "Custom" layout slot.
export const CUSTOM_LAYOUT_ID = "custom";

// ---- Normalization / migration ----------------------------------------------

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/** Accept a widget that may use the legacy `size` string and return one with
 *  explicit numeric w/h, clamped to the grid. Safe to call on new-format
 *  widgets too. */
export function normalizeWidget(raw: unknown): Widget {
  const w = raw as Partial<Widget> & { size?: string };
  let width = typeof w.w === "number" ? w.w : NaN;
  let height = typeof w.h === "number" ? w.h : NaN;

  if ((Number.isNaN(width) || Number.isNaN(height)) && w.size) {
    const dims = WIDGET_SIZES[w.size as WidgetSize];
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  }
  if (Number.isNaN(width)) width = 4;
  if (Number.isNaN(height)) height = 3;

  const x = clamp(w.position?.x ?? 0, 0, GRID_COLS - 1);
  const y = clamp(w.position?.y ?? 0, 0, GRID_ROWS - 1);

  return {
    id: String(w.id),
    type: w.type as WidgetType,
    title: String(w.title ?? ""),
    w: clamp(width, MIN_W, GRID_COLS),
    h: clamp(height, MIN_H, GRID_ROWS),
    position: { x, y },
  };
}

/** Normalize an entire layout (migrating legacy widgets in the process). */
export function normalizeLayout(layout: GridLayout): GridLayout {
  return {
    ...layout,
    widgets: (layout.widgets ?? []).map(normalizeWidget),
  };
}

// ---- Collision helpers ------------------------------------------------------

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boundsOf(widget: Pick<Widget, "position" | "w" | "h">): Bounds {
  return {
    left: widget.position.x,
    top: widget.position.y,
    right: widget.position.x + widget.w,
    bottom: widget.position.y + widget.h,
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
  candidate: Pick<Widget, "position" | "w" | "h">,
  others: Widget[],
  excludeId?: string
): boolean {
  const cb = boundsOf(candidate);
  return others.some((o) => o.id !== excludeId && overlaps(cb, boundsOf(o)));
}

/** True if a widget of (w,h) placed at (x,y) is on-grid and collision-free. */
export function fits(
  w: number,
  h: number,
  position: { x: number; y: number },
  others: Widget[],
  excludeId?: string
): boolean {
  if (position.x < 0 || position.y < 0) return false;
  if (position.x + w > GRID_COLS) return false;
  if (position.y + h > GRID_ROWS) return false;
  return !checkCollision({ position, w, h }, others, excludeId);
}

/** Scan row-by-row for the first empty slot that fits (w,h). */
export function findEmptyPosition(
  w: number,
  h: number,
  widgets: Widget[],
  excludeId?: string
): { x: number; y: number } | null {
  for (let y = 0; y <= GRID_ROWS - h; y++) {
    for (let x = 0; x <= GRID_COLS - w; x++) {
      if (fits(w, h, { x, y }, widgets, excludeId)) return { x, y };
    }
  }
  return null;
}

// ---- Layout engine hook -----------------------------------------------------

export function useGridLayout(initialLayout: GridLayout) {
  const [layout, setLayout] = useState<GridLayout>(() =>
    normalizeLayout(initialLayout)
  );
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [editMode, setEditModeState] = useState(false);

  // editMode mirrored in a ref so effects can read it without re-subscribing.
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  // Remember the user's custom arrangement so switching between a preset and
  // Custom is non-destructive. Seeded from the initial layout if it was custom.
  const customRef = useRef<GridLayout | null>(
    initialLayout.isCustom ? normalizeLayout(initialLayout) : null
  );

  // Always-current layout (for reading inside callbacks without stale closures)
  // and a snapshot taken when an edit session begins (to support Cancel).
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const editSnapshotRef = useRef<GridLayout | null>(null);

  // Keep internal layout in sync if the caller swaps the initial layout
  // (e.g. after loading a persisted layout asynchronously). NEVER do this while
  // an edit is in progress — it would wipe the user's unsaved changes.
  const initialIdRef = useRef(initialLayout.id);
  useEffect(() => {
    if (editModeRef.current) return;
    if (initialLayout.id !== initialIdRef.current) {
      initialIdRef.current = initialLayout.id;
      const next = normalizeLayout(initialLayout);
      if (next.isCustom) customRef.current = next;
      setLayout(next);
      setExpandedWidget(null);
    }
  }, [initialLayout]);

  // Whenever the active layout is custom, remember it as the latest custom
  // arrangement to restore when the user toggles back from a preset.
  useEffect(() => {
    if (layout.isCustom) customRef.current = layout;
  }, [layout]);

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
        if (!fits(widget.w, widget.h, position, prev.widgets, widgetId))
          return prev;
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

  /** Resize a widget to an arbitrary (w,h) footprint. The size is clamped to
   *  the grid/minimum and only committed if it does not overlap a neighbour.
   *  Anchor (top-left) position is preserved. */
  const resizeWidget = useCallback(
    (widgetId: string, w: number, h: number) => {
      setLayout((prev) => {
        const widget = prev.widgets.find((wd) => wd.id === widgetId);
        if (!widget) return prev;

        const maxW = GRID_COLS - widget.position.x;
        const maxH = GRID_ROWS - widget.position.y;
        const nextW = clamp(Math.round(w), MIN_W, maxW);
        const nextH = clamp(Math.round(h), MIN_H, maxH);

        if (nextW === widget.w && nextH === widget.h) return prev;
        if (!fits(nextW, nextH, widget.position, prev.widgets, widgetId))
          return prev;

        return markCustom({
          ...prev,
          widgets: prev.widgets.map((wd) =>
            wd.id === widgetId ? { ...wd, w: nextW, h: nextH } : wd
          ),
        });
      });
    },
    []
  );

  const toggleExpand = useCallback((widgetId: string) => {
    setExpandedWidget((prev) => (prev === widgetId ? null : widgetId));
  }, []);

  const addWidget = useCallback(
    (widget: Omit<Widget, "position">) => {
      setLayout((prev) => {
        // Try the requested footprint first; if it doesn't fit, try
        // progressively smaller ones so the widget still lands somewhere.
        const candidates: Array<{ w: number; h: number }> = [
          { w: widget.w, h: widget.h },
          { w: 6, h: 4 },
          { w: 6, h: 3 },
          { w: 4, h: 4 },
          { w: 4, h: 3 },
          { w: 3, h: 3 },
          { w: MIN_W, h: MIN_H },
        ];
        for (const { w, h } of candidates) {
          const cw = clamp(w, MIN_W, GRID_COLS);
          const ch = clamp(h, MIN_H, GRID_ROWS);
          const pos = findEmptyPosition(cw, ch, prev.widgets);
          if (pos) {
            return markCustom({
              ...prev,
              widgets: [
                ...prev.widgets,
                { ...widget, w: cw, h: ch, position: pos },
              ],
            });
          }
        }
        return prev; // no space at all
      });
    },
    []
  );

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
    setLayout(normalizeLayout(next));
    setExpandedWidget(null);
  }, []);

  /** Switch to the single editable "Custom" layout. Restores the user's
   *  remembered custom arrangement if there is one, otherwise seeds it from
   *  the layout currently on screen. */
  const selectCustom = useCallback(() => {
    setLayout((prev) => {
      if (prev.isCustom) return prev;
      const base = customRef.current;
      const seeded: GridLayout = base
        ? { ...base }
        : { ...prev, widgets: prev.widgets.map((w) => ({ ...w })) };
      return {
        ...seeded,
        id: CUSTOM_LAYOUT_ID,
        name: "Custom",
        description: "Your personalized layout",
        isCustom: true,
      };
    });
    setExpandedWidget(null);
  }, []);

  // ---- Edit session (Save / Cancel) ----------------------------------------
  // Snapshot the layout when editing starts so Cancel can restore it, and
  // re-snapshot on a successful Save so a later Cancel reverts to what was saved.
  const beginEdit = useCallback(() => {
    editSnapshotRef.current = layoutRef.current;
  }, []);

  const commitEdit = useCallback(() => {
    editSnapshotRef.current = layoutRef.current;
  }, []);

  const cancelEdit = useCallback(() => {
    if (editSnapshotRef.current) setLayout(editSnapshotRef.current);
    setExpandedWidget(null);
  }, []);

  const setEditMode = useCallback((v: boolean) => {
    setEditModeState(v);
  }, []);

  /** Gravity-compact: pull every widget as far up as it can go without
   *  overlapping, processing top-to-bottom. Columns (x) are preserved; only
   *  vertical gaps are removed. Triggered manually from the toolbar. */
  const compact = useCallback(() => {
    setLayout((prev) => {
      const sorted = [...prev.widgets].sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x
      );
      const placed: Widget[] = [];
      for (const w of sorted) {
        let y = w.position.y;
        while (
          y > 0 &&
          fits(w.w, w.h, { x: w.position.x, y: y - 1 }, placed, w.id)
        ) {
          y--;
        }
        placed.push({ ...w, position: { x: w.position.x, y } });
      }
      // No-op if nothing actually moved (avoid marking custom needlessly).
      const changed = placed.some((p) => {
        const orig = prev.widgets.find((o) => o.id === p.id);
        return orig && orig.position.y !== p.position.y;
      });
      if (!changed) return prev;
      return markCustom({ ...prev, widgets: placed });
    });
  }, []);

  return useMemo(
    () => ({
      layout,
      widgets: layout.widgets,
      expandedWidget,
      editMode,
      setEditMode,
      isExpanded: (id: string) => expandedWidget === id,
      moveWidget,
      resizeWidget,
      toggleExpand,
      addWidget,
      removeWidget,
      replaceLayout,
      selectCustom,
      beginEdit,
      commitEdit,
      cancelEdit,
      compact,
    }),
    [
      layout,
      expandedWidget,
      editMode,
      setEditMode,
      moveWidget,
      resizeWidget,
      toggleExpand,
      addWidget,
      removeWidget,
      replaceLayout,
      selectCustom,
      beginEdit,
      commitEdit,
      cancelEdit,
      compact,
    ]
  );
}
