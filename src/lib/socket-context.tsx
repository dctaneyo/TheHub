"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { isReloadBlocked, deferReload } from "@/lib/reload-guard";
import { recordReload, recordEvent, logStartupDiagnostics } from "@/lib/reload-diagnostics";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  updating: boolean;
  // Convenience: emit an event
  emit: (event: string, data?: any) => void;
  // Join/leave conversation rooms
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  // Typing
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  // Activity tracking
  updateActivity: (page: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  updating: false,
  emit: () => {},
  joinConversation: () => {},
  leaveConversation: () => {},
  startTyping: () => {},
  stopTyping: () => {},
  updateActivity: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children, guestName, guestMeetingId }: { children: React.ReactNode; guestName?: string; guestMeetingId?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [currentBuild, setCurrentBuild] = useState<string | null>(null);
  const [newBuild, setNewBuild] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // One-time startup diagnostic — reports navigation type + reload breadcrumbs
    // (helps identify reloads, since a full reload clears the console).
    logStartupDiagnostics();

    // Track tab background/foreground so we can correlate reloads with the tab
    // being discarded by the browser (common on Safari) vs an in-app reload.
    const onVisibility = () =>
      recordEvent(document.hidden ? "tab hidden" : "tab visible");
    document.addEventListener("visibilitychange", onVisibility);

    // Build auth payload — include guest info if provided
    const auth: Record<string, string> = {};
    if (guestName) auth.guestName = guestName;
    if (guestMeetingId) auth.guestMeetingId = guestMeetingId;

    const s = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: Object.keys(auth).length > 0 ? auth : undefined,
    });

    s.on("connect", () => {
      setIsConnected(true);
      // Emit immediately on connect so lastSeen is fresh right away
      s.emit("client:heartbeat");
    });

    // Server emits build:id on every connect.
    //
    // We compare the server's build against the build THIS browser bundle was
    // compiled from (NEXT_PUBLIC_BUILD_ID, baked in at build time) — NOT against
    // "the first build:id we happened to receive". Reconnecting to a same-version
    // process (replicas, crash-restarts) must NEVER trigger a reload; a reload is
    // only warranted when the running bundle is genuinely older than the server.
    //
    // Three safeguards prevent spurious / disruptive reloads:
    //  1. Never reload while a reload is "blocked" (e.g. an unsaved layout edit
    //     is in progress) — the reload is deferred until the block lifts.
    //  2. A short settle timer; cancelled if we reconnect to a matching instance
    //     (rolling deploys won't flap).
    //  3. An "already attempted this build" guard: if we reloaded hoping to reach
    //     a newer build but our bundle is STILL old afterwards (e.g. a stale
    //     service-worker cache served the old JS), we stop — no reload loop.
    const clientBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
    const SETTLE_MS = 4000;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let reloadScheduled = false;

    const scheduleReload = (serverBuildId: string) => {
      if (reloadScheduled) return;

      // Already tried to reach this exact build and we're still on the old
      // bundle → reloading won't help (stale cache). Don't loop.
      if (sessionStorage.getItem("hub-reload-target") === serverBuildId) return;

      // Guard against rapid repeated reloads (e.g. within 60s of last reload).
      const lastReload = sessionStorage.getItem("hub-last-reload");
      if (lastReload && Date.now() - Number(lastReload) < 60000) return;

      const doReload = () => {
        if (reloadScheduled) return;
        reloadScheduled = true;
        setCurrentBuild(clientBuildId ?? null);
        setNewBuild(serverBuildId);
        setUpdating(true);
        sessionStorage.setItem("hub-last-reload", String(Date.now()));
        sessionStorage.setItem("hub-reload-target", serverBuildId);
        recordReload(`build-update ${clientBuildId} -> ${serverBuildId}`);
        console.warn(
          `[Hub] build update detected (running ${clientBuildId}, server ${serverBuildId}) — reloading in 3.5s`
        );
        // Brief delay so the splash animation is visible before reload.
        setTimeout(() => window.location.reload(), 3500);
      };

      // Hold the reload if something (an unsaved edit) is currently protected.
      if (isReloadBlocked()) {
        deferReload(doReload);
        return;
      }
      doReload();
    };

    s.on("build:id", ({ buildId }: { buildId: string }) => {
      // Ignore fallback/dev values — they don't represent real builds.
      if (!buildId || buildId === "dev") return;
      // If we can't identify our own bundle, don't risk a false reload.
      if (!clientBuildId || clientBuildId === "dev") return;
      if (reloadScheduled) return;

      // Never reload on the login page while the user is in an active input step
      // (user ID / PIN entry). The login page itself manages setReloadBlocked()
      // based on whether an org has been resolved — so we respect that here by
      // checking isReloadBlocked() rather than hard-coding the pathname.
      // The org entry screen (no org resolved yet) is idle and allows reloads.

      // Server matches the bundle we're running — fully up to date. Cancel any
      // pending settle and clear the attempted-target marker.
      if (buildId === clientBuildId) {
        if (settleTimer) {
          clearTimeout(settleTimer);
          settleTimer = null;
        }
        sessionStorage.removeItem("hub-reload-target");
        return;
      }

      // Server reports a different build than our bundle → settle, then reload.
      if (settleTimer) return; // already waiting
      settleTimer = setTimeout(() => {
        settleTimer = null;
        scheduleReload(buildId);
      }, SETTLE_MS);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
    });

    s.on("connect_error", () => {
      // Connection error handled silently
    });

    // Force session management — ARL can remotely logout or reassign this device
    s.on("session:force-logout", () => {
      // Already on login — nothing to do
      if (window.location.pathname.startsWith("/login")) return;
      recordReload("session:force-logout");
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    });

    s.on("session:force-redirect", async (data: { token: string; redirectTo: string }) => {
      // Don't redirect away from login unless explicitly going somewhere else
      if (window.location.pathname.startsWith("/login") && data.redirectTo === "/login") return;
      recordReload(`session:force-redirect ${data.redirectTo}`);
      try {
        await fetch("/api/auth/force-apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: data.token }),
        });
      } catch {}
      window.location.href = data.redirectTo;
    });

    // Emit client:heartbeat every 30s over the socket — updates lastSeen in DB
    // and emits presence:update to ARLs without an HTTP round-trip
    const heartbeatInterval = setInterval(() => {
      if (s.connected) s.emit("client:heartbeat");
    }, 30000);

    socketRef.current = s;
    setSocket(s);

    return () => {
      clearInterval(heartbeatInterval);
      if (settleTimer) clearTimeout(settleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("conversation:join", conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("conversation:leave", conversationId);
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing:start", { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing:stop", { conversationId });
  }, []);

  const updateActivity = useCallback((page: string) => {
    socketRef.current?.emit("activity:update", { page });
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, updating, emit, joinConversation, leaveConversation, startTyping, stopTyping, updateActivity }}>
      {children}
      <UpdateSplash visible={updating} currentBuild={currentBuild} newBuild={newBuild} />
    </SocketContext.Provider>
  );
}

function UpdateSplash({ visible, currentBuild, newBuild }: { visible: boolean; currentBuild: string | null; newBuild: string | null }) {
  const fmt = (id: string | null) => id ? (id.length > 8 ? id.slice(0, 7) : id) : "—";
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950"
        >
          {/* Pulsing ring */}
          <div className="relative flex items-center justify-center mb-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-4 border-[var(--hub-red)]/30"
                initial={{ width: 80, height: 80, opacity: 0.6 }}
                animate={{ width: 220, height: 220, opacity: 0 }}
                transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
            {/* Hub logo */}
            <motion.div
              className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--hub-red)] shadow-2xl shadow-red-300 dark:shadow-red-900/50"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-3xl font-black text-white">H</span>
            </motion.div>
          </div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-center px-8"
          >
            <p className="text-2xl font-black text-foreground mb-1">App Updated!</p>
            <p className="text-sm font-semibold text-muted-foreground mb-6">Loading the latest build. Please wait…</p>

            {/* Skeleton bars */}
            <div className="w-64 space-y-2.5">
              {["w-full", "w-4/5", "w-3/5"].map((w, i) => (
                <motion.div
                  key={i}
                  className={`${w} h-3 rounded-full bg-muted overflow-hidden mx-auto`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-muted via-muted-foreground/20 to-muted"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Build version info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 font-mono text-xs text-muted-foreground/60 space-y-0.5"
            >
              <p>Current: {fmt(currentBuild)}</p>
              <p>New: {fmt(newBuild)}</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
