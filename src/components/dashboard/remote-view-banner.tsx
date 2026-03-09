"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { RemoteCaptureManager } from "@/lib/remote-capture";
import { Eye, X, Hand } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface RemoteViewBannerProps {
  onSessionChange?: (active: boolean) => void;
}

export function RemoteViewBanner({ onSessionChange }: RemoteViewBannerProps) {
  const { socket } = useSocket();
  const [activeSession, setActiveSession] = useState<{ sessionId: string; arlName: string; controlEnabled: boolean } | null>(null);
  const captureManagerRef = useRef<RemoteCaptureManager | null>(null);

  // Notify parent when session state changes
  useEffect(() => {
    onSessionChange?.(activeSession !== null);
  }, [activeSession, onSessionChange]);

  // Listen for remote view events
  useEffect(() => {
    if (!socket) return;

    // Auto-start: server sends "remote-view:start" — no consent needed
    const onStart = (data: { sessionId: string; arlId: string; arlName: string }) => {
      // If already in a session, ignore
      if (captureManagerRef.current) return;

      // Start capture immediately
      const manager = new RemoteCaptureManager(socket, data.sessionId);
      manager.start();
      captureManagerRef.current = manager;

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

    const onEnded = (data: { sessionId: string; endedBy: string; endedByType: string; reason?: string }) => {
      if (activeSession?.sessionId === data.sessionId) {
        if (captureManagerRef.current) {
          captureManagerRef.current.stop();
          captureManagerRef.current = null;
        }
        setActiveSession(null);
      }
    };

    socket.on("remote-view:start", onStart);
    socket.on("remote-view:control-toggled", onControlToggled);
    socket.on("remote-view:ended", onEnded);

    return () => {
      socket.off("remote-view:start", onStart);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("remote-view:ended", onEnded);
    };
  }, [socket, activeSession]);

  // End active session (location can still disconnect)
  const endSession = useCallback(() => {
    if (!socket || !activeSession) return;

    socket.emit("remote-view:end", { sessionId: activeSession.sessionId });

    if (captureManagerRef.current) {
      captureManagerRef.current.stop();
      captureManagerRef.current = null;
    }

    setActiveSession(null);
  }, [socket, activeSession]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (captureManagerRef.current) {
        captureManagerRef.current.stop();
        captureManagerRef.current = null;
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="fixed top-4 right-4 z-[998]"
        >
          <div className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm",
            activeSession.controlEnabled
              ? "border-amber-300 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-950/95"
              : "border-indigo-200 dark:border-indigo-900 bg-indigo-50/95 dark:bg-indigo-950/95"
          )}>
            <div className="flex items-center gap-2">
              {activeSession.controlEnabled ? (
                <Hand className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "h-2 w-2 rounded-full animate-pulse",
                    activeSession.controlEnabled ? "bg-amber-500" : "bg-indigo-500"
                  )} />
                  <span className="text-xs font-bold text-foreground">
                    {activeSession.controlEnabled ? "Remote Control" : "Being Viewed"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  by {activeSession.arlName}
                </p>
              </div>
            </div>
            <button
              onClick={endSession}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
