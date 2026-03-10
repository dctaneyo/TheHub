"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/lib/socket-context";
import { RemoteCaptureManager } from "@/lib/remote-capture";
import { Eye, Hand } from "@/lib/icons";

interface RemoteViewBannerProps {
  onSessionChange?: (active: boolean) => void;
  onCaptureManagerChange?: (manager: RemoteCaptureManager | null) => void;
}

export function RemoteViewBanner({ onSessionChange, onCaptureManagerChange }: RemoteViewBannerProps) {
  const { socket } = useSocket();
  const [activeSession, setActiveSession] = useState<{ sessionId: string; arlName: string; controlEnabled: boolean } | null>(null);
  const captureManagerRef = useRef<RemoteCaptureManager | null>(null);

  // Notify parent when session state changes
  useEffect(() => {
    onSessionChange?.(activeSession !== null);
  }, [activeSession, onSessionChange]);

  // Listen for remote view events (stable — no activeSession dependency)
  useEffect(() => {
    if (!socket) return;

    // Auto-start: server sends "remote-view:start" — no consent needed
    const onStart = (data: { sessionId: string; arlId: string; arlName: string }) => {
      // If already in a session, ignore
      if (captureManagerRef.current) return;

      // Start capture in mirror mode (lightweight: cursor/click/scroll only, no screenshots)
      const manager = new RemoteCaptureManager(socket, data.sessionId, true);
      manager.start();
      captureManagerRef.current = manager;
      onCaptureManagerChange?.(manager);

      setActiveSession({
        sessionId: data.sessionId,
        arlName: data.arlName,
        controlEnabled: false,
      });
    };

    const onControlToggled = (data: { sessionId: string; enabled: boolean; arlName: string }) => {
      setActiveSession(prev =>
        prev && prev.sessionId === data.sessionId
          ? { ...prev, controlEnabled: data.enabled }
          : prev
      );
    };

    // Always clean up on ended — no stale closure issue
    const onEnded = () => {
      if (captureManagerRef.current) {
        captureManagerRef.current.stop();
        captureManagerRef.current = null;
      }
      onCaptureManagerChange?.(null);
      setActiveSession(null);
    };

    socket.on("remote-view:start", onStart);
    socket.on("remote-view:control-toggled", onControlToggled);
    socket.on("remote-view:ended", onEnded);

    return () => {
      socket.off("remote-view:start", onStart);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("remote-view:ended", onEnded);
    };
  }, [socket]);

  // End active session (location can still disconnect)
  const endSession = useCallback(() => {
    if (!socket || !activeSession) return;

    socket.emit("remote-view:end", { sessionId: activeSession.sessionId });

    if (captureManagerRef.current) {
      captureManagerRef.current.stop();
      captureManagerRef.current = null;
    }
    onCaptureManagerChange?.(null);

    setActiveSession(null);
  }, [socket, activeSession, onCaptureManagerChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (captureManagerRef.current) {
        captureManagerRef.current.stop();
        captureManagerRef.current = null;
      }
    };
  }, []);

  if (!activeSession) return null;

  const isControl = activeSession.controlEnabled;
  const borderColor = isControl ? "#f59e0b" : "#6366f1"; // amber-500 / indigo-500

  return (
    <div
      data-remote-view-overlay="true"
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ boxShadow: `inset 0 0 0 3px ${borderColor}` }}
    >
      {/* Bottom bar with message */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-auto flex items-center justify-center gap-2 py-1.5"
        style={{ backgroundColor: borderColor }}
      >
        {isControl ? (
          <Hand className="h-3.5 w-3.5 text-white" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-white" />
        )}
        <span className="text-xs font-bold text-white tracking-wide">
          {isControl
            ? `Being controlled by ${activeSession.arlName}`
            : `Being viewed by ${activeSession.arlName}`}
        </span>
      </div>
    </div>
  );
}
