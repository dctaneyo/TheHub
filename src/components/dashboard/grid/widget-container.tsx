"use client";

import { useState, useCallback, useRef, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, X, Hand } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useGrid } from "./grid-context";
import {
  GRID_COLS,
  GRID_ROWS,
  MIN_W,
  MIN_H,
  fits,
  type Widget,
} from "./grid-engine";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function WidgetContainer({
  widget,
  gridRef,
  children,
}: {
  widget: Widget;
  gridRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const {
    widgets,
    editMode,
    isExpanded,
    toggleExpand,
    moveWidget,
    resizeWidget,
    removeWidget,
  } = useGrid();

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const expanded = isExpanded(widget.id);
  const { w: width, h: height } = widget;

  // Latest widgets snapshot for collision checks inside pointer handlers
  // (avoids stale closures while a drag/resize is in flight).
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  // ---- Drag to move --------------------------------------------------------
  const handleMovePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editMode || expanded || !gridRef.current) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const rect = gridRef.current.getBoundingClientRect();
      const cellW = rect.width / GRID_COLS;
      const cellH = rect.height / GRID_ROWS;
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...widget.position };
      let lastX = startPos.x;
      let lastY = startPos.y;
      setDragging(true);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nx = clamp(
          startPos.x + Math.round(dx / cellW),
          0,
          GRID_COLS - width
        );
        const ny = clamp(
          startPos.y + Math.round(dy / cellH),
          0,
          GRID_ROWS - height
        );
        if (nx === lastX && ny === lastY) return;
        lastX = nx;
        lastY = ny;
        // Show a blocked state instead of silently freezing when the target
        // cell overlaps a neighbour.
        if (fits(width, height, { x: nx, y: ny }, widgetsRef.current, widget.id)) {
          setBlocked(false);
          moveWidget(widget.id, { x: nx, y: ny });
        } else {
          setBlocked(true);
        }
      };
      const onUp = () => {
        setDragging(false);
        setBlocked(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editMode, expanded, gridRef, widget.id, widget.position, width, height, moveWidget]
  );

  // ---- Drag corner to resize ----------------------------------------------
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editMode || expanded || !gridRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const rect = gridRef.current.getBoundingClientRect();
      const cellW = rect.width / GRID_COLS;
      const cellH = rect.height / GRID_ROWS;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = widget.w;
      const startH = widget.h;
      const maxW = GRID_COLS - widget.position.x;
      const maxH = GRID_ROWS - widget.position.y;
      let lastW = startW;
      let lastH = startH;
      setResizing(true);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nw = clamp(startW + Math.round(dx / cellW), MIN_W, maxW);
        const nh = clamp(startH + Math.round(dy / cellH), MIN_H, maxH);
        if (nw === lastW && nh === lastH) return;
        lastW = nw;
        lastH = nh;
        if (fits(nw, nh, widget.position, widgetsRef.current, widget.id)) {
          setBlocked(false);
          resizeWidget(widget.id, nw, nh);
        } else {
          setBlocked(true);
        }
      };
      const onUp = () => {
        setResizing(false);
        setBlocked(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editMode, expanded, gridRef, widget.id, widget.position, widget.w, widget.h, resizeWidget]
  );

  const active = dragging || resizing;
  const gridStyle: React.CSSProperties = expanded
    ? {}
    : {
        gridColumn: `${widget.position.x + 1} / span ${width}`,
        gridRow: `${widget.position.y + 1} / span ${height}`,
        zIndex: active ? 40 : undefined,
      };

  return (
    <>
      {/* Backdrop when expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-background/80 backdrop-blur-sm"
            onClick={() => toggleExpand(widget.id)}
          />
        )}
      </AnimatePresence>

      <motion.div
        layout={!active}
        style={gridStyle}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
          !active && "border-border",
          active && "border-transparent",
          active && !blocked && "shadow-lg ring-2 ring-primary/40",
          active && blocked && "shadow-lg ring-2 ring-destructive",
          expanded &&
            "fixed inset-4 z-[151] rounded-3xl shadow-2xl md:inset-8",
          editMode && !active && !expanded && "ring-1 ring-primary/20"
        )}
      >
        {/* Header — only while editing (drag handle / size / remove).
            Removed in normal view for a cleaner, chrome-free tile. */}
        {editMode && !expanded && (
          <div
            className="flex h-11 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 active:cursor-grabbing"
            onPointerDown={handleMovePointerDown}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Hand className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-semibold text-foreground">
                {widget.title}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                  active && blocked
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {width}×{height}
              </span>
            </div>

            <button
              type="button"
              onClick={() => removeWidget(widget.id)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Floating expand control — view mode only, always visible (no hover-only on touch) */}
        {!editMode && !expanded && (
          <button
            type="button"
            onClick={() => toggleExpand(widget.id)}
            className="absolute right-1.5 top-1.5 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground active:bg-muted"
            title="Expand"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {/* Floating collapse control — while expanded */}
        {expanded && (
          <button
            type="button"
            onClick={() => toggleExpand(widget.id)}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Collapse"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
        )}

        {/* Content — non-interactive while editing so layout taps/drags don't
            accidentally trigger actions inside the widget. Dimmed + slightly
            desaturated to make the non-interactive state visually obvious. */}
        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-auto transition-[opacity,filter] duration-200",
            editMode &&
              !expanded &&
              "pointer-events-none select-none opacity-50 grayscale-[35%]"
          )}
        >
          {children}
        </div>

        {/* Resize handle (edit mode only, bottom-right corner) — larger for touch */}
        {editMode && !expanded && (
          <div
            onPointerDown={handleResizePointerDown}
            className="absolute bottom-0 right-0 z-20 flex h-8 w-8 cursor-nwse-resize items-end justify-end p-1"
            title="Drag to resize"
          >
            <span
              className={cn(
                "block h-4 w-4 rounded-br-md border-b-2 border-r-2 transition-colors",
                active && blocked
                  ? "border-destructive"
                  : "border-primary/60 group-hover:border-primary"
              )}
            />
          </div>
        )}
      </motion.div>
    </>
  );
}
