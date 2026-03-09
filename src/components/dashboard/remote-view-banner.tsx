"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { RemoteCaptureManager } from "@/lib/remote-capture";
import { Eye, X, Hand, Monitor } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface RemoteViewRequest {
  sessionId: string;
  arlId: string;
  arlName: string;
}

export function RemoteViewBanner() {
  const { socket } = useSocket();
  const [pendingRequest, setPendingRequest] = useState<RemoteViewRequest | null>(null);
  const [activeSession, setActiveSession] = useState<{ sessionId: string; arlName: string; controlEnabled: boolean } | null>(null);
  const captureManagerRef = useRef<RemoteCaptureManager | null>(null);
  const autoRejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for remote view requests
  useEffect(() => {
    if (!socket) return;

    const onRequest = (data: RemoteViewRequest) => {
      // If already in a session, auto-reject new requests
      if (activeSession) {
        socket.emit("remote-view:reject", { sessionId: data.sessionId });
        return;
      }
      setPendingRequest(data);

      // Auto-reject after 30 seconds if no response
      if (autoRejectTimerRef.current) clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = setTimeout(() => {
        socket.emit("remote-view:reject", { sessionId: data.sessionId });
        setPendingRequest(null);
      }, 30000);
    };

    const onControlToggled = (data: { sessionId: string; enabled: boolean; arlName: string }) => {
      setActiveSession(prev =>
        prev && prev.sessionId === data.sessionId
          ? { ...prev, controlEnabled: data.enabled }
          : prev
      );
    };

    const onEnded = (data: { sessionId: string; endedBy: string; endedByType: string; reason?: string }) => {
      if (activeSession?.sessionId === data.sessionId || pendingRequest?.sessionId === data.sessionId) {
        // Clean up capture manager
        if (captureManagerRef.current) {
          captureManagerRef.current.stop();
          captureManagerRef.current = null;
        }
        setActiveSession(null);
        setPendingRequest(null);
      }
    };

    socket.on("remote-view:request", onRequest);
    socket.on("remote-view:control-toggled", onControlToggled);
    socket.on("remote-view:ended", onEnded);

    return () => {
      socket.off("remote-view:request", onRequest);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("remote-view:ended", onEnded);
    };
  }, [socket, activeSession, pendingRequest]);

  // Accept request
  const acceptRequest = useCallback(() => {
    if (!socket || !pendingRequest) return;

    if (autoRejectTimerRef.current) {
      clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = null;
    }

    socket.emit("remote-view:accept", { sessionId: pendingRequest.sessionId });

    // Start capture
    const manager = new RemoteCaptureManager(socket, pendingRequest.sessionId);
    manager.start();
    captureManagerRef.current = manager;

    setActiveSession({
      sessionId: pendingRequest.sessionId,
      arlName: pendingRequest.arlName,
      controlEnabled: false,
    });
    setPendingRequest(null);
  }, [socket, pendingRequest]);

  // Reject request
  const rejectRequest = useCallback(() => {
    if (!socket || !pendingRequest) return;

    if (autoRejectTimerRef.current) {
      clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = null;
    }

    socket.emit("remote-view:reject", { sessionId: pendingRequest.sessionId });
    setPendingRequest(null);
  }, [socket, pendingRequest]);

  // End active session
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
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Pending request consent banner */}
      <AnimatePresence>
        {pendingRequest && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-[90vw] max-w-md"
          >
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-card shadow-2xl shadow-indigo-200/30 dark:shadow-indigo-950/50 p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950">
                  <Eye className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground">Remote View Request</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{pendingRequest.arlName}</span>{" "}
                    wants to view your screen
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    They will see your current page and interactions
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={acceptRequest}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-3 px-4 transition-colors shadow-sm"
                >
                  <Eye className="h-4 w-4" />
                  Allow
                </button>
                <button
                  onClick={rejectRequest}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-muted hover:bg-accent text-foreground font-medium text-sm py-3 px-4 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Decline
                </button>
              </div>
              {/* Auto-reject countdown */}
              <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-400"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 30, ease: "linear" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active session indicator */}
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
    </>
  );
}
