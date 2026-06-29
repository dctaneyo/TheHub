"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import {
  Monitor,
  X,
  Eye,
  Hand,
  Wifi,
  WifiOff,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth-context";

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
  userRole?: string;
}

export function RemoteViewer({ userRole }: RemoteViewerProps) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [targets, setTargets] = useState<RemoteTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<RemoteTarget | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [controlEnabled, setControlEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "disconnected">("connected");
  const [modalOpen, setModalOpen] = useState(false);

  // ── Fetch online targets ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const res = await fetch("/api/locations");
        if (!res.ok) return;
        const data = await res.json();
        const locs: RemoteTarget[] = (data.locations || [])
          .filter((l: { isOnline?: boolean }) => l.isOnline)
          .map((loc: { id: string; name: string; storeNumber?: string; currentPage?: string }) => ({
            id: loc.id,
            name: loc.name,
            storeNumber: loc.storeNumber,
            isOnline: true,
            currentPage: loc.currentPage,
            userKind: "location" as const,
          }));
        const arls: RemoteTarget[] = userRole === "admin"
          ? (data.arls || [])
              .filter((a: { isOnline?: boolean }) => a.isOnline)
              .map((arl: { id: string; name: string; currentPage?: string; role?: string }) => ({
                id: arl.id,
                name: arl.name,
                isOnline: true,
                currentPage: arl.currentPage,
                userKind: "arl" as const,
                role: arl.role,
              }))
          : [];
        setTargets([...locs, ...arls].filter((t) => t.id !== user?.id));
      } catch {}
    };
    fetchTargets();
    const interval = setInterval(fetchTargets, 15_000);
    return () => clearInterval(interval);
  }, [userRole, user?.id]);

  // ── Presence updates ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { userId: string; isOnline: boolean }) => {
      setTargets((prev) =>
        data.isOnline
          ? prev.map((t) => (t.id === data.userId ? { ...t, isOnline: true } : t))
          : prev.filter((t) => t.id !== data.userId),
      );
    };
    socket.on("presence:update", handler);
    return () => { socket.off("presence:update", handler); };
  }, [socket]);

  // ── Session socket events ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onRequested = (data: { sessionId: string }) => {
      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      setSessionStatus("connecting");
    };

    const onAccepted = (data: { sessionId: string }) => {
      if (sessionIdRef.current === data.sessionId) {
        setSessionStatus("active");
        setTimeout(() => {
          if (sessionIdRef.current === data.sessionId) {
            socket.emit("remote-view:heartbeat", { sessionId: data.sessionId });
          }
        }, 2000);
      }
    };

    const onRejected = () => {
      setSessionStatus("ended");
      setSessionId(null);
      sessionIdRef.current = null;
      setTimeout(() => { setSessionStatus("idle"); setModalOpen(false); }, 2000);
    };

    const onControlToggled = (data: { sessionId: string; enabled: boolean }) => {
      if (data.sessionId === sessionIdRef.current) setControlEnabled(data.enabled);
    };

    const onEnded = (data: { sessionId: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setSessionStatus("ended");
      setSessionId(null);
      sessionIdRef.current = null;
      setControlEnabled(false);
      setConnectionStatus("connected");
      setTimeout(() => { setSessionStatus("idle"); setModalOpen(false); }, 1500);
    };

    const onReconnecting = (data: { sessionId: string; disconnectedUserType: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      if (data.disconnectedUserType === "location") setConnectionStatus("reconnecting");
    };

    const onReconnected = (data: { sessionId: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setConnectionStatus("connected");
    };

    socket.on("remote-view:requested", onRequested);
    socket.on("remote-view:accepted", onAccepted);
    socket.on("remote-view:rejected", onRejected);
    socket.on("remote-view:control-toggled", onControlToggled);
    socket.on("remote-view:ended", onEnded);
    socket.on("remote-view:reconnecting", onReconnecting);
    socket.on("remote-view:reconnected", onReconnected);

    return () => {
      socket.off("remote-view:requested", onRequested);
      socket.off("remote-view:accepted", onAccepted);
      socket.off("remote-view:rejected", onRejected);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("remote-view:ended", onEnded);
      socket.off("remote-view:reconnecting", onReconnecting);
      socket.off("remote-view:reconnected", onReconnected);
    };
  }, [socket]);

  // ── Auto-rejoin + heartbeat ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onSocketReconnect = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      setConnectionStatus("reconnecting");
      socket.emit("remote-view:rejoin", { sessionId: sid });
    };
    const onRejoinResult = (data: { sessionId: string; success: boolean }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      if (data.success) {
        setConnectionStatus("connected");
      } else {
        setSessionStatus("ended");
        setSessionId(null);
        sessionIdRef.current = null;
        setConnectionStatus("disconnected");
        setTimeout(() => { setSessionStatus("idle"); setModalOpen(false); }, 2000);
      }
    };
    socket.on("connect", onSocketReconnect);
    socket.on("remote-view:rejoin-result", onRejoinResult);
    return () => {
      socket.off("connect", onSocketReconnect);
      socket.off("remote-view:rejoin-result", onRejoinResult);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const interval = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      socket.emit("remote-view:heartbeat", { sessionId: sid });
    }, 10_000);
    const onHeartbeatAck = (data: { sessionId: string; alive: boolean; otherReconnecting?: boolean; otherConnected?: boolean }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      if (!data.alive) {
        setSessionStatus("ended");
        setSessionId(null);
        sessionIdRef.current = null;
        setConnectionStatus("disconnected");
        setTimeout(() => { setSessionStatus("idle"); setModalOpen(false); }, 2000);
        return;
      }
      if (data.otherReconnecting) setConnectionStatus("reconnecting");
      else if (data.otherConnected) setConnectionStatus((p) => (p === "reconnecting" ? "connected" : p));
    };
    socket.on("remote-view:heartbeat-ack", onHeartbeatAck);
    return () => { clearInterval(interval); socket.off("remote-view:heartbeat-ack", onHeartbeatAck); };
  }, [socket]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startSession = useCallback((target: RemoteTarget) => {
    if (!socket) return;
    setSelectedTarget(target);
    setControlEnabled(false);
    setConnectionStatus("connected");
    setSessionStatus("connecting");
    setModalOpen(true);
    socket.emit("remote-view:request", { locationId: target.id });
  }, [socket]);

  const endSession = useCallback(() => {
    if (!socket || !sessionIdRef.current) return;
    socket.emit("remote-view:end", { sessionId: sessionIdRef.current });
    setSessionStatus("ended");
    setSessionId(null);
    sessionIdRef.current = null;
    setControlEnabled(false);
    setTimeout(() => { setSessionStatus("idle"); setModalOpen(false); }, 600);
  }, [socket]);

  const toggleControl = useCallback(() => {
    if (!socket || !sessionIdRef.current) return;
    const next = !controlEnabled;
    socket.emit("remote-view:toggle-control", { sessionId: sessionIdRef.current, enabled: next });
    setControlEnabled(next);
  }, [socket, controlEnabled]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Location grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hub-teal-light)]">
              <Monitor className="h-5 w-5 text-[var(--hub-teal)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Remote View</h2>
              <p className="text-xs text-muted-foreground">
                {targets.length === 0
                  ? "No locations online"
                  : `${targets.length} location${targets.length !== 1 ? "s" : ""} online — tap to view`}
              </p>
            </div>
          </div>
        </div>

        {targets.length === 0 ? (
          <EmptyState icon={WifiOff} title="No online locations found" subtext="Locations appear here when they're signed in" className="py-16" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {targets.map((t) => (
              <button
                key={t.id}
                onClick={() => startSession(t)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.98]"
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
                  <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    {t.userKind === "arl" && (
                      <span className="shrink-0 rounded-full bg-purple-100 dark:bg-purple-950 px-2 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">ARL</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.userKind === "location" && t.storeNumber
                      ? `Store #${t.storeNumber}`
                      : t.userKind === "arl"
                      ? (t.role || "ARL")
                      : ""}
                  </p>
                  {t.currentPage && (
                    <p className="text-xs text-[var(--hub-teal)] mt-1 truncate">
                      {t.currentPage}
                    </p>
                  )}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-teal-light)] text-[var(--hub-teal)] transition-colors">
                  <Eye className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen mirror modal */}
      <AnimatePresence>
        {modalOpen && selectedTarget && (
          <MirrorModal
            target={selectedTarget}
            sessionId={sessionId}
            sessionStatus={sessionStatus}
            controlEnabled={controlEnabled}
            connectionStatus={connectionStatus}
            onToggleControl={toggleControl}
            onEnd={endSession}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Fullscreen mirror modal ───────────────────────────────────────────────────

interface MirrorModalProps {
  target: RemoteTarget;
  sessionId: string | null;
  sessionStatus: "idle" | "connecting" | "active" | "ended";
  controlEnabled: boolean;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  onToggleControl: () => void;
  onEnd: () => void;
}

function MirrorModal({
  target,
  sessionId,
  sessionStatus,
  controlEnabled,
  connectionStatus,
  onToggleControl,
  onEnd,
}: MirrorModalProps) {
  const { user } = useAuth();

  // Build the iframe URL once we have a session ID
  const iframeUrl = sessionId
    ? `/dashboard?mirror=${encodeURIComponent(target.id)}&session=${encodeURIComponent(sessionId)}&locationName=${encodeURIComponent(target.name)}&embed=true`
    : null;

  const isConnecting = sessionStatus === "connecting";
  const isEnded = sessionStatus === "ended";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 16 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="fixed inset-0 z-[500] flex flex-col bg-black"
    >
      {/* ── Toolbar ── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-neutral-900 px-4">
        {/* Status dot + location name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {connectionStatus === "reconnecting" ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
          ) : isConnecting ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--hub-teal)] animate-pulse" />
          ) : isEnded ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
          )}
          <span className="text-sm font-semibold text-white truncate">
            {isConnecting
              ? `Connecting to ${target.name}…`
              : isEnded
              ? "Session ended"
              : connectionStatus === "reconnecting"
              ? `Reconnecting to ${target.name}…`
              : target.name}
          </span>
          {!isConnecting && !isEnded && target.storeNumber && (
            <span className="shrink-0 text-xs text-white/40">Store #{target.storeNumber}</span>
          )}
          {!isConnecting && !isEnded && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white/60">
              Mirror
            </span>
          )}
        </div>

        {/* Right-side controls — only shown when active */}
        {!isConnecting && !isEnded && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Control toggle */}
            <button
              onClick={onToggleControl}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                controlEnabled
                  ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                  : "bg-white/10 text-white/70 active:bg-white/15"
              )}
            >
              {controlEnabled ? <Hand className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {controlEnabled ? "Control" : "View only"}
            </button>

            {/* End button */}
            <button
              onClick={onEnd}
              className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 ring-1 ring-red-500/30 transition-colors active:bg-red-500/30"
            >
              <X className="h-3.5 w-3.5" />
              End
            </button>
          </div>
        )}

        {/* Connecting — show cancel */}
        {isConnecting && (
          <button
            onClick={onEnd}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/60 active:bg-white/15 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="relative flex-1 min-h-0">
        {/* Connecting overlay — shown while session is being established */}
        <AnimatePresence>
          {isConnecting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-neutral-950"
            >
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">Connecting to {target.name}</p>
                <p className="mt-1 text-sm text-white/40">Starting mirror session…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ended overlay */}
        <AnimatePresence>
          {isEnded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-neutral-950"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <X className="h-7 w-7 text-white/60" />
              </div>
              <p className="text-sm font-semibold text-white/60">Session ended</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The mirror iframe — rendered as soon as we have a session ID so it
            starts loading immediately. The connecting overlay sits on top until
            the session is active, then fades out to reveal the iframe. */}
        {iframeUrl && (
          <iframe
            key={iframeUrl}
            src={iframeUrl}
            className="h-full w-full border-0"
            title={`Mirror: ${target.name}`}
            allow="camera; microphone; display-capture"
            style={controlEnabled ? undefined : { pointerEvents: "none" }}
          />
        )}
      </div>
    </motion.div>
  );
}
