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
import type { DOMSnapshot, CapturedElement, UserEvent } from "@/lib/socket-handlers/types";

interface OnlineLocation {
  id: string;
  name: string;
  storeNumber: string;
  isOnline: boolean;
  currentPage?: string;
}

export function RemoteViewer() {
  const { socket } = useSocket();
  const [locations, setLocations] = useState<OnlineLocation[]>([]);
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

  // Fetch online locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/locations");
        if (res.ok) {
          const data = await res.json();
          setLocations(
            (data.locations || []).map((loc: any) => ({
              id: loc.id,
              name: loc.name,
              storeNumber: loc.storeNumber,
              isOnline: loc.isOnline || false,
              currentPage: loc.currentPage,
            }))
          );
        }
      } catch {}
    };
    fetchLocations();
    const interval = setInterval(fetchLocations, 15000);
    return () => clearInterval(interval);
  }, []);

  // Update online status from presence events
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { userId: string; isOnline: boolean }) => {
      setLocations(prev =>
        prev.map(loc =>
          loc.id === data.userId ? { ...loc, isOnline: data.isOnline } : loc
        )
      );
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

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const onlineLocations = locations.filter(l => l.isOnline);

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
                ? `Viewing: ${selectedLocation?.name || "Location"}`
                : `${onlineLocations.length} location${onlineLocations.length !== 1 ? "s" : ""} online`}
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

      {/* Idle state — location picker */}
      {sessionStatus === "idle" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map(loc => (
            <button
              key={loc.id}
              disabled={!loc.isOnline}
              onClick={() => requestRemoteView(loc.id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                loc.isOnline
                  ? "border-border bg-card hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-800 cursor-pointer"
                  : "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                loc.isOnline ? "bg-emerald-100 dark:bg-emerald-950" : "bg-muted"
              )}>
                {loc.isOnline
                  ? <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  : <WifiOff className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{loc.name}</p>
                <p className="text-xs text-muted-foreground">Store #{loc.storeNumber}</p>
                {loc.isOnline && loc.currentPage && (
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                    Currently on: {loc.currentPage}
                  </p>
                )}
              </div>
              {loc.isOnline && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                  <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
              )}
            </button>
          ))}
          {locations.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Monitor className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No locations found</p>
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
              Waiting for {selectedLocation?.name || "location"} to accept
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
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Main viewer */}
          <div
            ref={containerRef}
            className={cn(
              "flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-black/5 dark:bg-white/5 overflow-hidden",
              controlEnabled && "cursor-crosshair"
            )}
          >
            {/* Status bar */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-foreground">{snapshot.title}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{snapshot.viewport.width}×{snapshot.viewport.height}</span>
                <span>Scroll: {snapshot.scroll.y}px</span>
                <span>{snapshot.elements.length} elements</span>
              </div>
            </div>

            {/* DOM reconstruction */}
            <div
              ref={viewerRef}
              onClick={handleViewerClick}
              onWheel={handleViewerScroll}
              onMouseMove={handleViewerMouseMove}
              onMouseLeave={() => setHoveredElement(null)}
              className="relative flex-1 overflow-hidden"
              style={{
                aspectRatio: `${snapshot.viewport.width} / ${snapshot.viewport.height}`,
              }}
            >
              {/* Background grid */}
              <div className="absolute inset-0 bg-white dark:bg-slate-900" />

              {/* Render captured elements */}
              <svg
                viewBox={`0 0 ${snapshot.viewport.width} ${snapshot.viewport.height}`}
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
                {snapshot.elements.map((el, i) => {
                  const isHovered = hoveredElement?.selector === el.selector;
                  const isInput = ["input", "textarea", "select"].includes(el.tag);
                  const isButton = el.tag === "button" || el.tag === "a" || el.classes?.includes("btn");
                  const isHeading = ["h1", "h2", "h3", "h4"].includes(el.tag);

                  let fill = "transparent";
                  let stroke = "transparent";
                  let strokeWidth = 0;

                  if (el.interactive) {
                    if (isButton) {
                      fill = isHovered && controlEnabled ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.06)";
                      stroke = isHovered && controlEnabled ? "rgba(99,102,241,0.7)" : "rgba(99,102,241,0.25)";
                      strokeWidth = isHovered ? 2 : 1;
                    } else if (isInput) {
                      fill = "rgba(59,130,246,0.05)";
                      stroke = "rgba(59,130,246,0.3)";
                      strokeWidth = 1;
                    } else {
                      fill = isHovered && controlEnabled ? "rgba(99,102,241,0.1)" : "transparent";
                      stroke = isHovered && controlEnabled ? "rgba(99,102,241,0.5)" : "transparent";
                      strokeWidth = isHovered ? 1 : 0;
                    }
                  }

                  return (
                    <g key={`${el.selector}-${i}`}>
                      <rect
                        x={el.rect.x}
                        y={el.rect.y}
                        width={el.rect.width}
                        height={el.rect.height}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        rx={el.interactive ? 4 : 0}
                      />
                      {/* Text labels */}
                      {el.text && el.rect.width > 20 && el.rect.height > 10 && (
                        <text
                          x={el.rect.x + (isInput ? 8 : el.rect.width / 2)}
                          y={el.rect.y + el.rect.height / 2}
                          textAnchor={isInput ? "start" : "middle"}
                          dominantBaseline="central"
                          fontSize={isHeading ? 14 : isButton ? 11 : 10}
                          fontWeight={isHeading || isButton ? "bold" : "normal"}
                          fill={isButton ? "rgb(79,70,229)" : isHeading ? "rgb(15,23,42)" : "rgb(100,116,139)"}
                          opacity={0.9}
                          clipPath={`inset(0 0 0 0)`}
                        >
                          {el.text.length > 40 ? el.text.slice(0, 40) + "…" : el.text}
                        </text>
                      )}
                      {/* Input value display */}
                      {isInput && el.value && (
                        <text
                          x={el.rect.x + 8}
                          y={el.rect.y + el.rect.height / 2}
                          dominantBaseline="central"
                          fontSize={11}
                          fill="rgb(51,65,85)"
                        >
                          {el.value.length > 30 ? el.value.slice(0, 30) + "…" : el.value}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Remote cursor (location user's cursor) */}
                {cursorPos && (
                  <g>
                    <circle
                      cx={cursorPos.x}
                      cy={cursorPos.y}
                      r={8}
                      fill="rgba(239,68,68,0.3)"
                      stroke="rgba(239,68,68,0.8)"
                      strokeWidth={2}
                    />
                    <circle
                      cx={cursorPos.x}
                      cy={cursorPos.y}
                      r={3}
                      fill="rgb(239,68,68)"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Side panel */}
          {!isFullscreen && (
            <div className="w-[260px] shrink-0 flex flex-col gap-3">
              {/* Session info */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold text-foreground mb-2">Session Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium text-foreground">{selectedLocation?.name}</span>
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

              {/* Interactive elements */}
              <div className="rounded-2xl border border-border bg-card p-4 flex-1 min-h-0 flex flex-col">
                <h3 className="text-sm font-bold text-foreground mb-2">
                  Interactive Elements ({snapshot.elements.filter(e => e.interactive).length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {snapshot.elements
                    .filter(e => e.interactive)
                    .slice(0, 30)
                    .map((el, i) => (
                      <button
                        key={`${el.selector}-${i}`}
                        disabled={!controlEnabled}
                        onClick={() => {
                          if (!controlEnabled || !socket || !sessionId) return;
                          socket.emit("remote-view:action", {
                            sessionId,
                            action: { type: "click", selector: el.selector },
                          });
                        }}
                        className={cn(
                          "w-full text-left rounded-lg px-2 py-1.5 text-[10px] transition-colors",
                          controlEnabled
                            ? "hover:bg-indigo-50 dark:hover:bg-indigo-950 cursor-pointer"
                            : "cursor-default"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[8px] text-muted-foreground uppercase">
                            {el.tag}
                          </span>
                          <span className="truncate text-foreground font-medium">
                            {el.text || el.value || el.placeholder || el.id || "—"}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* User activity feed */}
              <div className="rounded-2xl border border-border bg-card p-4 max-h-[200px] flex flex-col">
                <h3 className="text-sm font-bold text-foreground mb-2">Live Activity</h3>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {userEvents.length === 0 && (
                    <p className="text-[10px] text-muted-foreground py-2">No activity yet</p>
                  )}
                  {userEvents.map((evt, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className={cn(
                        "shrink-0 rounded px-1 py-0.5 font-mono uppercase",
                        evt.type === "click" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400" :
                        evt.type === "input" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {evt.type}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {evt.selector ? evt.selector.split(" > ").pop() : `(${evt.coords?.x}, ${evt.coords?.y})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
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
