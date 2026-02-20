"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, Hash, Monitor, Smartphone, Tablet, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "@/lib/socket-context";

interface SessionInfo {
  id: string;
  code: string;
  isOnline: boolean;
  isCurrent: boolean;
  deviceType: string | null;
  createdAt: string;
  lastSeen: string;
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-3 w-3" />;
  if (type === "tablet") return <Tablet className="h-3 w-3" />;
  return <Monitor className="h-3 w-3" />;
}

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showCode, setShowCode] = useState(false);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const popdownRef = useRef<HTMLDivElement>(null);

  const checkConnection = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok || res.status === 401) {
        setIsOnline(true);
        setIsReconnecting(false);
      } else {
        throw new Error("Server error");
      }
    } catch {
      setIsOnline(false);
      startReconnect();
    }
  };

  const fetchSessionCode = async () => {
    try {
      const res = await fetch("/api/session/code", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSessionCode(data.sessionCode || null);
        setSessions(data.sessions || []);
      }
    } catch {}
  };

  const startReconnect = () => {
    if (reconnectTimer.current) return;
    setIsReconnecting(true);
    reconnectTimer.current = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok || res.status === 401) {
          setIsOnline(true);
          setIsReconnecting(false);
          if (reconnectTimer.current) {
            clearInterval(reconnectTimer.current);
            reconnectTimer.current = null;
          }
        }
      } catch {}
    }, 5000);
  };

  const { socket, isConnected: socketConnected } = useSocket();

  // Re-fetch session list on socket connect (picks up new session after login)
  // and when a session:updated event arrives (force logout/reassign from ARL).
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => fetchSessionCode();
    const onSessionUpdated = () => setTimeout(fetchSessionCode, 500);
    socket.on("connect", onConnect);
    socket.on("session:updated", onSessionUpdated);
    return () => {
      socket.off("connect", onConnect);
      socket.off("session:updated", onSessionUpdated);
    };
  }, [socket]);

  // Use WebSocket connection state as primary online indicator
  useEffect(() => {
    setIsOnline(socketConnected);
    if (!socketConnected && !isReconnecting) {
      startReconnect();
    } else if (socketConnected) {
      setIsReconnecting(false);
      if (reconnectTimer.current) {
        clearInterval(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    }
  }, [socketConnected]);

  useEffect(() => {
    checkConnection();
    fetchSessionCode();

    const handleOnline = () => checkConnection();
    const handleOffline = () => { setIsOnline(false); startReconnect(); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
      if (reconnectTimer.current) clearInterval(reconnectTimer.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!showCode) return;
    const handleClick = (e: MouseEvent) => {
      if (popdownRef.current && !popdownRef.current.contains(e.target as Node)) {
        setShowCode(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCode]);

  // API already filters to online-only; multiSession = more than one active session
  const multiSession = sessions.length > 1;

  return (
    <div className="relative" ref={popdownRef}>
      <AnimatePresence mode="wait">
        {isOnline ? (
          <motion.button
            key="online"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setShowCode((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-2 cursor-pointer hover:bg-emerald-100 transition-colors"
          >
            <div className="relative">
              <Wifi className="h-4 w-4 text-emerald-600" />
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-emerald-50 bg-emerald-500" />
            </div>
            <span className="text-xs font-semibold text-emerald-700">Connected</span>
            {sessionCode && (
              <span className="ml-0.5 font-mono text-xs font-bold text-emerald-600 tracking-wider">
                #{sessionCode}
              </span>
            )}
            {multiSession && (
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                {sessions.length}
              </span>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="offline"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-2"
          >
            {isReconnecting ? (
              <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs font-semibold text-red-600">
              {isReconnecting ? "Reconnecting..." : "Offline"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCode && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Active Sessions ({sessions.length})
              </p>
              {multiSession && (
                <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                  <span className="text-[9px] font-bold text-amber-600">Multiple active</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {sessions.length === 0 && (
                <p className="text-xs text-slate-400">No active sessions</p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${s.isCurrent ? "bg-emerald-50" : "bg-slate-50"}`}
                >
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${s.isCurrent ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
                    <DeviceIcon type={s.deviceType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-xs font-bold tracking-widest text-slate-800">{s.code}</span>
                      {s.isCurrent && <span className="text-[9px] font-semibold text-emerald-600">(this)</span>}
                    </div>
                    <p className="text-[9px] text-slate-400 truncate">
                      {s.deviceType ?? "unknown"} · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-400" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
