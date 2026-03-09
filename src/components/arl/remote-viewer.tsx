"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import {
  Monitor,
  X,
  Eye,
  Hand,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import type { DOMSnapshot, CapturedElement, UserEvent } from "@/lib/socket-handlers/types";

interface RemoteTarget {
  id: string;
  name: string;
  storeNumber?: string;
  isOnline: boolean;
  currentPage?: string;
  userKind: "location" | "arl";
  role?: string;
}

interface RemoteViewerProps {
  userRole?: string; // "admin" | "arl" | etc
}

export function RemoteViewer({ userRole }: RemoteViewerProps) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [targets, setTargets] = useState<RemoteTarget[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "pending" | "active" | "ended">("idle");
  const [snapshot, setSnapshot] = useState<DOMSnapshot | null>(null);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [hoveredElement, setHoveredElement] = useState<CapturedElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch online targets (locations + ARLs for admins)
  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const res = await fetch("/api/locations");
        if (res.ok) {
          const data = await res.json();
          const locs: RemoteTarget[] = (data.locations || [])
            .filter((l: any) => l.isOnline)
            .map((loc: any) => ({
              id: loc.id,
              name: loc.name,
              storeNumber: loc.storeNumber,
              isOnline: true,
              currentPage: loc.currentPage,
              userKind: "location" as const,
            }));
          // Admins can also control ARLs
          const arls: RemoteTarget[] = userRole === "admin"
            ? (data.arls || [])
                .filter((a: any) => a.isOnline)
                .map((arl: any) => ({
                  id: arl.id,
                  name: arl.name,
                  isOnline: true,
                  currentPage: arl.currentPage,
                  userKind: "arl" as const,
                  role: arl.role,
                }))
            : [];
          // Filter out self — admin/ARL shouldn't see themselves as a target
          const allTargets = [...locs, ...arls].filter(t => t.id !== user?.id);
          setTargets(allTargets);
        }
      } catch {}
    };
    fetchTargets();
    const interval = setInterval(fetchTargets, 15000);
    return () => clearInterval(interval);
  }, [userRole, user?.id]);

  // Update online status from presence events — add/remove targets in real time
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { userId: string; isOnline: boolean; userType?: string }) => {
      setTargets(prev => {
        if (data.isOnline) {
          // Already in list? update it. Otherwise it'll appear on next poll.
          return prev.map(t => t.id === data.userId ? { ...t, isOnline: true } : t);
        } else {
          // Remove offline targets
          return prev.filter(t => t.id !== data.userId);
        }
      });
    };
    socket.on("presence:update", handler);
    return () => { socket.off("presence:update", handler); };
  }, [socket]);

  // Socket event listeners for remote view
  useEffect(() => {
    if (!socket) return;

    const onRequested = (data: { sessionId: string; locationId: string }) => {
      setSessionId(data.sessionId);
      setSessionStatus("pending");
    };

    const onAccepted = (data: { sessionId: string; locationName: string }) => {
      setSessionStatus("active");
    };

    const onRejected = (data: { sessionId: string; locationName: string }) => {
      setSessionStatus("ended");
      setSessionId(null);
      setTimeout(() => setSessionStatus("idle"), 3000);
    };

    const onSnapshot = (data: { sessionId: string; snapshot: DOMSnapshot }) => {
      if (data.sessionId === sessionId) {
        setSnapshot(data.snapshot);
      }
    };

    const onCursor = (data: { sessionId: string; x: number; y: number }) => {
      if (data.sessionId === sessionId) {
        setCursorPos({ x: data.x, y: data.y });
      }
    };

    const onUserEvent = (data: { sessionId: string; event: UserEvent }) => {
      if (data.sessionId === sessionId) {
        setUserEvents(prev => [data.event, ...prev].slice(0, 20));
      }
    };

    const onControlToggled = (data: { sessionId: string; enabled: boolean }) => {
      if (data.sessionId === sessionId) {
        setControlEnabled(data.enabled);
      }
    };

    const onEnded = (data: { sessionId: string; endedBy: string; reason?: string }) => {
      if (data.sessionId === sessionId) {
        setSessionStatus("ended");
        setSessionId(null);
        setSnapshot(null);
        setCursorPos(null);
        setControlEnabled(false);
        setIsFullscreen(false);
        setTimeout(() => setSessionStatus("idle"), 2000);
      }
    };

    socket.on("remote-view:requested", onRequested);
    socket.on("remote-view:accepted", onAccepted);
    socket.on("remote-view:rejected", onRejected);
    socket.on("remote-view:snapshot", onSnapshot);
    socket.on("remote-view:cursor", onCursor);
    socket.on("remote-view:user-event", onUserEvent);
    socket.on("remote-view:control-toggled", onControlToggled);
    socket.on("remote-view:ended", onEnded);

    return () => {
      socket.off("remote-view:requested", onRequested);
      socket.off("remote-view:accepted", onAccepted);
      socket.off("remote-view:rejected", onRejected);
      socket.off("remote-view:snapshot", onSnapshot);
      socket.off("remote-view:cursor", onCursor);
      socket.off("remote-view:user-event", onUserEvent);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("remote-view:ended", onEnded);
    };
  }, [socket, sessionId]);

  // Request remote view
  const requestRemoteView = useCallback((locationId: string) => {
    if (!socket) return;
    setSelectedLocationId(locationId);
    setSessionStatus("pending");
    setShowLocationPicker(false);
    socket.emit("remote-view:request", { locationId });
  }, [socket]);

  // End session
  const endSession = useCallback(() => {
    if (!socket || !sessionId) return;
    socket.emit("remote-view:end", { sessionId });
    setSessionStatus("ended");
    setSessionId(null);
    setSnapshot(null);
    setCursorPos(null);
    setControlEnabled(false);
    setIsFullscreen(false);
    setTimeout(() => setSessionStatus("idle"), 1000);
  }, [socket, sessionId]);

  // Toggle control
  const toggleControl = useCallback(() => {
    if (!socket || !sessionId) return;
    const newState = !controlEnabled;
    socket.emit("remote-view:toggle-control", { sessionId, enabled: newState });
    setControlEnabled(newState);
  }, [socket, sessionId, controlEnabled]);

  // Handle click on viewer (when control is enabled)
  const handleViewerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!socket || !sessionId || !controlEnabled || !snapshot || !viewerRef.current) return;

    const rect = viewerRef.current.getBoundingClientRect();
    const scaleX = snapshot.viewport.width / rect.width;
    const scaleY = snapshot.viewport.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find the closest interactive element at these coordinates
    const targetElement = snapshot.elements.find(el => {
      if (!el.interactive) return false;
      return (
        x >= el.rect.x && x <= el.rect.x + el.rect.width &&
        y >= el.rect.y && y <= el.rect.y + el.rect.height
      );
    });

    socket.emit("remote-view:action", {
      sessionId,
      action: {
        type: "click",
        selector: targetElement?.selector,
        coords: { x: Math.round(x), y: Math.round(y) },
      },
    });
  }, [socket, sessionId, controlEnabled, snapshot]);

  // Handle scroll on viewer
  const handleViewerScroll = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!socket || !sessionId || !controlEnabled) return;
    e.preventDefault();
    socket.emit("remote-view:action", {
      sessionId,
      action: {
        type: "scroll",
        scrollDelta: { x: 0, y: e.deltaY },
      },
    });
  }, [socket, sessionId, controlEnabled]);

  // Handle mouse move over viewer for hover effects
  const handleViewerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!snapshot || !viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const scaleX = snapshot.viewport.width / rect.width;
    const scaleY = snapshot.viewport.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hovered = snapshot.elements.find(el => {
      if (!el.interactive) return false;
      return (
        x >= el.rect.x && x <= el.rect.x + el.rect.width &&
        y >= el.rect.y && y <= el.rect.y + el.rect.height
      );
    });
    setHoveredElement(hovered || null);
  }, [snapshot]);

  const selectedTarget = targets.find(l => l.id === selectedLocationId);

  return (
    <div className={cn(
      "flex flex-col gap-4",
      isFullscreen && "fixed inset-0 z-[200] bg-background p-4"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950">
            <Monitor className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Remote View</h2>
            <p className="text-xs text-muted-foreground">
              {sessionStatus === "active"
                ? `Viewing: ${selectedTarget?.name || "Target"}`
                : `${targets.length} target${targets.length !== 1 ? "s" : ""} online`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionStatus === "active" && (
            <>
              <button
                onClick={toggleControl}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                  controlEnabled
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-800"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {controlEnabled ? <Hand className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {controlEnabled ? "Control On" : "View Only"}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-accent transition-colors"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={endSession}
                className="flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900 transition-colors"
              >
                <X className="h-4 w-4" />
                End Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Idle state — target picker (online only) */}
      {sessionStatus === "idle" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {targets.map(t => (
            <button
              key={t.id}
              onClick={() => requestRemoteView(t.id)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-800 cursor-pointer p-4 text-left transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
                <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                  {t.userKind === "arl" && (
                    <span className="shrink-0 rounded-full bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 dark:text-purple-300 uppercase">ARL</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.userKind === "location" && t.storeNumber ? `Store #${t.storeNumber}` : t.userKind === "arl" ? (t.role || "ARL") : ""}
                </p>
                {t.currentPage && (
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                    Currently on: {t.currentPage}
                  </p>
                )}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </button>
          ))}
          {targets.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Monitor className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No online targets found</p>
            </div>
          )}
        </div>
      )}

      {/* Pending state */}
      {sessionStatus === "pending" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-indigo-200 dark:border-indigo-900" />
            <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">Requesting Access...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Waiting for {selectedTarget?.name || "target"} to accept
            </p>
          </div>
          <button
            onClick={() => {
              if (sessionId) {
                socket?.emit("remote-view:end", { sessionId });
              }
              setSessionStatus("idle");
              setSessionId(null);
            }}
            className="mt-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active view */}
      {sessionStatus === "active" && snapshot && (
        <ActiveRemoteView
          snapshot={snapshot}
          controlEnabled={controlEnabled}
          cursorPos={cursorPos}
          userEvents={userEvents}
          hoveredElement={hoveredElement}
          isFullscreen={isFullscreen}
          selectedTarget={selectedTarget}
          sessionId={sessionId}
          socket={socket}
          viewerRef={viewerRef}
          containerRef={containerRef}
          onViewerClick={handleViewerClick}
          onViewerScroll={handleViewerScroll}
          onViewerMouseMove={handleViewerMouseMove}
          onHoverClear={() => setHoveredElement(null)}
        />
      )}

      {/* Ended state */}
      {sessionStatus === "ended" && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <X className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Session ended</p>
        </div>
      )}
    </div>
  );
}

// ── HTML-based remote view renderer ──

interface ActiveRemoteViewProps {
  snapshot: DOMSnapshot;
  controlEnabled: boolean;
  cursorPos: { x: number; y: number } | null;
  userEvents: UserEvent[];
  hoveredElement: CapturedElement | null;
  isFullscreen: boolean;
  selectedTarget: RemoteTarget | undefined;
  sessionId: string | null;
  socket: any;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onViewerClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onViewerScroll: (e: React.WheelEvent<HTMLDivElement>) => void;
  onViewerMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHoverClear: () => void;
}

function ActiveRemoteView({
  snapshot,
  controlEnabled,
  cursorPos,
  userEvents,
  hoveredElement,
  isFullscreen,
  selectedTarget,
  sessionId,
  socket,
  viewerRef,
  containerRef,
  onViewerClick,
  onViewerScroll,
  onViewerMouseMove,
  onHoverClear,
}: ActiveRemoteViewProps) {
  const [scale, setScale] = useState(1);
  const outerRef = useRef<HTMLDivElement>(null);

  // Calculate scale to fit the remote viewport inside the viewer container.
  // No cap at 1 — allow upscaling so it fills available space (zoom to fit).
  useEffect(() => {
    const calculateScale = () => {
      if (!outerRef.current) return;
      const containerW = outerRef.current.clientWidth;
      const containerH = outerRef.current.clientHeight;
      if (containerW === 0 || containerH === 0) return;
      const scaleX = containerW / snapshot.viewport.width;
      const scaleY = containerH / snapshot.viewport.height;
      setScale(Math.min(scaleX, scaleY));
    };
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [snapshot.viewport.width, snapshot.viewport.height, isFullscreen]);

  const scaledW = snapshot.viewport.width * scale;
  const scaledH = snapshot.viewport.height * scale;

  return (
    <div className={cn(
      "flex gap-4 flex-1 min-h-0",
      isFullscreen && "gap-0"
    )}>
      {/* Main viewer */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-neutral-900 overflow-hidden",
          controlEnabled && "ring-2 ring-amber-400/50",
          isFullscreen && "rounded-none border-none"
        )}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-neutral-200 truncate max-w-[300px]">{snapshot.title}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-neutral-400">
            <span>{snapshot.viewport.width}×{snapshot.viewport.height}</span>
            <span>{snapshot.elements.length} el</span>
            {controlEnabled && (
              <span className="text-amber-400 font-semibold">CONTROL</span>
            )}
          </div>
        </div>

        {/* Scaled viewport */}
        <div
          ref={outerRef}
          className="relative flex-1 overflow-hidden flex items-center justify-center bg-neutral-950"
        >
          <div
            ref={viewerRef}
            onClick={onViewerClick}
            onWheel={onViewerScroll}
            onMouseMove={onViewerMouseMove}
            onMouseLeave={onHoverClear}
            className={cn("relative overflow-hidden", controlEnabled && "cursor-crosshair")}
            style={{
              width: scaledW,
              height: scaledH,
            }}
          >
            {/* Inner container at native resolution, scaled down */}
            <div
              style={{
                width: snapshot.viewport.width,
                height: snapshot.viewport.height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "relative",
                background: "#fff",
              }}
            >
              {/* Screenshot layer — pixel-perfect view of what the user sees */}
              {snapshot.screenshot ? (
                <img
                  src={snapshot.screenshot}
                  alt="Remote screen"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                    imageRendering: "auto",
                  }}
                  draggable={false}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    fontSize: 14,
                    background: "#f1f5f9",
                  }}
                >
                  Waiting for screenshot...
                </div>
              )}

              {/* Invisible interactive element overlay for click targeting */}
              {controlEnabled && snapshot.elements
                .filter(el => el.interactive)
                .map((el, i) => {
                  const isHov = hoveredElement?.selector === el.selector;
                  return (
                    <div
                      key={`target-${el.selector}-${i}`}
                      style={{
                        position: "absolute",
                        left: el.rect.x,
                        top: el.rect.y,
                        width: el.rect.width,
                        height: el.rect.height,
                        pointerEvents: "none",
                        border: isHov ? "2px solid rgba(99, 102, 241, 0.8)" : "1px solid transparent",
                        borderRadius: el.styles?.borderRadius || 4,
                        background: isHov ? "rgba(99, 102, 241, 0.12)" : "transparent",
                        zIndex: 10,
                        transition: "border 0.1s, background 0.1s",
                      }}
                    />
                  );
                })}

              {/* Remote cursor overlay */}
              {cursorPos && (
                <div
                  style={{
                    position: "absolute",
                    left: cursorPos.x - 12,
                    top: cursorPos.y - 12,
                    width: 24,
                    height: 24,
                    zIndex: 99999,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2px solid rgba(239, 68, 68, 0.8)",
                      background: "rgba(239, 68, 68, 0.15)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 8,
                      top: 8,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "rgb(239, 68, 68)",
                      boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Side panel */}
      {!isFullscreen && (
        <div className="w-[260px] shrink-0">
          {/* Session info */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground mb-2">Session Info</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-foreground">{selectedTarget?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">URL</span>
                <span className="font-medium text-foreground truncate max-w-[140px]">
                  {snapshot.url.replace(/https?:\/\/[^/]+/, "")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Viewport</span>
                <span className="font-medium text-foreground">
                  {snapshot.viewport.width}×{snapshot.viewport.height}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className={cn(
                  "font-medium",
                  controlEnabled ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {controlEnabled ? "Remote Control" : "View Only"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

