"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMirror } from "@/lib/mirror-context";
import { Eye, Hand, X, Monitor, Minimize2, Maximize2, Target, WifiOff } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function MirrorToolbar() {
  const {
    isMirroring,
    targetLocationName,
    controlEnabled,
    cursorVisible,
    targetDevice,
    connectionStatus,
    endMirror,
    toggleControl,
    toggleCursorVisible,
  } = useMirror();

  const [collapsed, setCollapsed] = useState(false);

  // ── Drag state ──
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 8 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const hasDraggedRef = useRef(false);

  // Center horizontally on mount
  useEffect(() => {
    if (pillRef.current) {
      const w = pillRef.current.offsetWidth;
      setPosition({ x: Math.round((window.innerWidth - w) / 2), y: 8 });
    }
  }, [collapsed]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag on interactive elements
    if ((e.target as HTMLElement).closest("button")) return;
    hasDraggedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y };
    setDragging(true);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDraggedRef.current = true;
    const el = pillRef.current;
    const maxX = window.innerWidth - (el?.offsetWidth || 200);
    const maxY = window.innerHeight - (el?.offsetHeight || 48);
    setPosition({
      x: Math.max(0, Math.min(maxX, dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(maxY, dragRef.current.origY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    const wasDrag = hasDraggedRef.current;
    dragRef.current = null;
    setDragging(false);
    // If collapsed and it was a tap (not a drag), expand
    if (collapsed && !wasDrag) {
      setCollapsed(false);
    }
  }, [collapsed]);

  if (!isMirroring) return null;

  return (
    <motion.div
      ref={pillRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      data-remote-view-overlay="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        "fixed z-[9998] select-none transition-opacity duration-300",
        dragging && "cursor-grabbing",
        !dragging && "cursor-grab",
        collapsed ? "opacity-60 active:opacity-90" : "opacity-100"
      )}
      style={{ left: position.x, top: position.y }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          /* ══════ COLLAPSED: Small glowing pill ══════ */
          <motion.div
            key="collapsed"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 backdrop-blur-xl shadow-lg",
              "bg-[var(--hub-teal)]/90 border-[var(--hub-teal)]/50"
            )}
          >
            {/* Pulsing glow ring */}
            <div className="absolute inset-0 rounded-full animate-pulse" style={{
              boxShadow: "0 0 12px 3px rgba(13,148,136,0.5), 0 0 24px 6px rgba(13,148,136,0.2)",
            }} />

            <div className="relative flex items-center gap-2">
              <div className="relative">
                <Monitor className="h-4 w-4 text-white" />
                <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-xs font-semibold text-white whitespace-nowrap">
                {targetLocationName || "Mirror"}
              </span>
            </div>

            <button
              onClick={() => setCollapsed(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/30 transition-colors"
              title="Expand toolbar"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </motion.div>
        ) : (
          /* ══════ EXPANDED: Full toolbar ══════ */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 rounded-2xl border border-[var(--hub-teal)]/30 bg-card/95 backdrop-blur-xl shadow-2xl px-4 py-2"
          >
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl",
                connectionStatus === "reconnecting"
                  ? "bg-amber-100 dark:bg-amber-950"
                  : "bg-[var(--hub-teal-light)]"
              )}>
                {connectionStatus === "reconnecting" ? (
                  <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Monitor className="h-4 w-4 text-[var(--hub-teal)]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {connectionStatus === "reconnecting" ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Reconnecting...
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold text-foreground">
                        Mirroring: {targetLocationName || "Target"}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {connectionStatus === "reconnecting" ? (
                    <span>Target connection lost — waiting for reconnect</span>
                  ) : targetDevice ? (
                    <span>
                      {targetDevice.isMobile ? "📱 Mobile" : "🖥️ Desktop"} • {targetDevice.width}×{targetDevice.height}
                    </span>
                  ) : (
                    <span>Connecting...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-border" />

            {/* Control toggle */}
            <button
              onClick={toggleControl}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                controlEnabled
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-800"
                  : "bg-muted text-muted-foreground active:bg-accent"
              )}
            >
              {controlEnabled ? <Hand className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {controlEnabled ? "Control On" : "View Only"}
            </button>

            {/* Cursor visibility toggle */}
            <button
              onClick={toggleCursorVisible}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                cursorVisible
                  ? "bg-[var(--hub-teal-light)] text-[var(--hub-teal)] ring-1 ring-[var(--hub-teal)]/30"
                  : "bg-muted text-muted-foreground active:bg-accent"
              )}
              title={cursorVisible ? "Hide cursor on target" : "Show cursor on target"}
            >
              <Target className="h-3.5 w-3.5" />
              {cursorVisible ? "Cursor On" : "Cursor Off"}
            </button>

            {/* Collapse */}
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground active:bg-accent active:text-foreground transition-colors"
              title="Collapse toolbar"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>

            {/* End session */}
            <button
              onClick={endMirror}
              className="flex items-center gap-1 rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 active:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:active:bg-red-900 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              End
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
