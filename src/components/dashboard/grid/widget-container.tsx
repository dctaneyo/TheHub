"use client";

import { useState, useRef, useCallback, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  X,
  Hand,
  Square,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useGrid } from "./grid-context";
import {
  WIDGET_SIZES,
  GRID_COLS,
  GRID_ROWS,
  type Widget,
  type WidgetSize,
} from "./grid-engine";

// Sizes offered in the per-widget resize menu.
const RESIZE_OPTIONS: WidgetSize[] = [
  "4x3",
  "4x4",
  "4x6",
  "6x4",
  "6x6",
  "8x6",
  "8x8",
  "12x4",
];

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
    editMode,
    isExpanded,
    toggleExpand,
    moveWidget,
    resizeWidget,
    removeWidget,
  } = useGrid();

  const [dragging, setDragging] = useState(false);
  const [showResize, setShowResize] = useState(false);
  const expanded = isExpanded(widget.id);
  const { width, height } = WIDGET_SIZES[widget.size];

  const handlePointerDown = useCallback(
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
        // Only commit when the target cell actually changes — avoids a
        // setLayout (and full grid re-render) on every pointermove pixel.
        if (nx === lastX && ny === lastY) return;
        lastX = nx;
        lastY = ny;
        moveWidget(widget.id, { x: nx, y: ny });
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editMode, expanded, gridRef, widget.id, widget.position, width, height, moveWidget]
  );

  const gridStyle: React.CSSProperties = expanded
    ? {}
    : {
        gridColumn: `${widget.position.x + 1} / span ${width}`,
        gridRow: `${widget.position.y + 1} / span ${height}`,
        zIndex: dragging ? 40 : undefined,
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
        layout={!dragging}
        style={gridStyle}
        className={cn(
          "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
          dragging && "shadow-lg ring-2 ring-primary/40",
          expanded &&
            "fixed inset-4 z-[151] rounded-3xl shadow-2xl md:inset-8",
          editMode && !expanded && "ring-1 ring-primary/20"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3",
            editMode && !expanded && "cursor-grab active:cursor-grabbing"
          )}
          onPointerDown={editMode && !expanded ? handlePointerDown : undefined}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {editMode && !expanded && (
              <Hand className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-xs font-semibold text-foreground">
              {widget.title}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* Resize (edit mode only) */}
            {editMode && !expanded && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowResize((v) => !v)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Resize"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
                <AnimatePresence>
                  {showResize && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute right-0 top-full z-50 mt-1 grid w-40 grid-cols-2 gap-1 rounded-lg border border-border bg-card p-2 shadow-lg"
                    >
                      {RESIZE_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            resizeWidget(widget.id, s);
                            setShowResize(false);
                          }}
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                            s === widget.size
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted-foreground/20"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Expand / collapse */}
            <button
              type="button"
              onClick={() => toggleExpand(widget.id)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Remove (edit mode only) */}
            {editMode && !expanded && (
              <button
                type="button"
                onClick={() => removeWidget(widget.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="relative min-h-0 flex-1 overflow-auto">{children}</div>
      </motion.div>
    </>
  );
}
