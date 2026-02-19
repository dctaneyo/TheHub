"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

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

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [updating, setUpdating] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Get the auth token from cookie (read by JS — not httpOnly for socket auth)
    // We'll pass it via handshake auth
    const s = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on("connect", () => {
      console.log("🔌 Socket connected:", s.id);
      setIsConnected(true);
      // Emit immediately on connect so lastSeen is fresh right away
      s.emit("client:heartbeat");
    });

    // Server emits build:id on every connect.
    // Store the first value we ever receive as the session baseline.
    // On any subsequent connect (reconnect), if the new build:id differs
    // from the baseline the server has redeployed — show the update splash
    // then reload to pick up the new bundle.
    let sessionBuildId: string | null = null;
    s.on("build:id", ({ buildId }: { buildId: string }) => {
      if (sessionBuildId === null) {
        // First connect — record baseline, no reload
        sessionBuildId = buildId;
        return;
      }
      if (buildId !== sessionBuildId) {
        console.log(`🔄 New build detected (${sessionBuildId} → ${buildId}), reloading…`);
        setUpdating(true);
        // Brief delay so the splash animation is visible before reload
        setTimeout(() => window.location.reload(), 3500);
      }
    });

    s.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      setIsConnected(false);
    });

    s.on("connect_error", (err) => {
      console.log("🔌 Socket connection error:", err.message);
    });

    // Force session management — ARL can remotely logout or reassign this device
    s.on("session:force-logout", () => {
      console.log("🔌 Force logout received");
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    });

    s.on("session:force-redirect", async (data: { token: string; redirectTo: string }) => {
      console.log("🔌 Force redirect received →", data.redirectTo);
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
      <UpdateSplash visible={updating} />
    </SocketContext.Provider>
  );
}

function UpdateSplash({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#fef2f2] via-[#fff7ed] to-[#fefce8]"
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
              className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--hub-red)] shadow-2xl shadow-red-300"
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
            <p className="text-2xl font-black text-slate-800 mb-1">App Updated!</p>
            <p className="text-sm font-medium text-slate-500 mb-6">Loading the latest build. Please wait…</p>

            {/* Skeleton bars */}
            <div className="w-64 space-y-2.5">
              {["w-full", "w-4/5", "w-3/5"].map((w, i) => (
                <motion.div
                  key={i}
                  className={`${w} h-3 rounded-full bg-slate-200 overflow-hidden mx-auto`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
