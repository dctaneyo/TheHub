"use client";

import { useState, useCallback, useRef, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, X, Hand } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { IconTip } from "@/components/ui/icon-tip";
import { useGrid } from "./grid-context";
import {
  GRID_COLS,
  GRID_ROWS,
  MIN_W,
  MIN_H,
  fits,
  isAmbientWidget,
  type Widget,
} from "./grid-engine";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function WidgetContainer({
  widget,
  gridRef,
  children,
  onExpand,
}: {
  widget: Widget;
  gridRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  /** When provided, clicking the expand button calls this instead of the default grid-expand. */
  onExpand?: () => void;
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

  // Ambient/glanceable widgets (a giant clock, a quote) don't need a card
  // boundary — they read fine sitting directly on the grid background, and
  // boxing them identically to data-dense widgets (Tasks, Calendar,
  // Messages) is exactly the "every feature crammed into a rounded box"
  // sameness that reads as generic (DESIGN.md Section 11, Non-Tells).
  // Still gets full chrome while editing/dragging/expanded, since the user
  // needs a visible boundary to grab, resize, or view it as an overlay then.
  const isAmbient = isAmbientWidget(widget.type);

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

      {(() => {
        // Ambient widgets only need their card boundary while there's a
        // reason to see one: editing (to grab/resize it), an active drag/
        // resize, or expanded into the fullscreen overlay. Otherwise no
        // border, no fill, no shadow — content sits straight on the grid.
        const showChrome = !isAmbient || editMode || active || expanded;
        return (
          <motion.div
            layout={!active}
            style={gridStyle}
            className={cn(
              "group relative flex flex-col overflow-hidden",
              showChrome && [
                // Tight bottom-right corner marks where the resize handle
                // lives — same logic as the chat bubble's pinched corner
                // pointing toward its sender, just pointed at a different
                // fact (an interactive corner, not a side). Reset to
                // uniform when expanded, since the resize handle isn't
                // shown in that state.
                "rounded-tl-3xl rounded-tr-3xl rounded-bl-3xl rounded-br-md border bg-card",
                !active && "border-border",
                active && "border-transparent",
                active && !blocked && "shadow-lg ring-2 ring-primary/40",
                active && blocked && "shadow-lg ring-2 ring-destructive",
                editMode && !active && !expanded && "ring-1 ring-primary/20",
              ],
              expanded &&
                "fixed inset-4 z-[151] rounded-tl-3xl rounded-tr-3xl rounded-bl-3xl rounded-br-3xl border bg-card shadow-2xl md:inset-8"
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

            <IconTip label="Remove widget">
              <button
                type="button"
                onClick={() => removeWidget(widget.id)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-destructive/10 active:text-destructive"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </IconTip>
          </div>
        )}

        {/* Floating expand control — view mode only; hidden for ambient widgets
            (clock, quote) since fullscreening them adds no function. */}
        {!editMode && !expanded && !isAmbient && (
          <IconTip label="Expand">
            <button
              type="button"
              onClick={() => (onExpand ? onExpand() : toggleExpand(widget.id))}
              className="absolute right-1.5 top-1.5 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-card/80 text-muted-foreground backdrop-blur-sm transition-colors active:text-foreground active:bg-muted"
              title="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </IconTip>
        )}

        {/* Floating collapse control — while expanded */}
        {expanded && (
          <IconTip label="Collapse">
            <button
              type="button"
              onClick={() => toggleExpand(widget.id)}
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors active:bg-muted active:text-foreground"
              title="Collapse"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </IconTip>
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
          <IconTip label="Drag to resize" side="top">
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
                    : active
                    ? "border-primary"
                    : "border-primary/60"
                )}
              />
            </div>
          </IconTip>
        )}
          </motion.div>
        );
      })()}
    </>
  );
}
