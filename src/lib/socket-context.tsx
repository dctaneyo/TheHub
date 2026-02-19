"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
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

    socketRef.current = s;
    setSocket(s);

    return () => {
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
    <SocketContext.Provider value={{ socket, isConnected, emit, joinConversation, leaveConversation, startTyping, stopTyping, updateActivity }}>
      {children}
    </SocketContext.Provider>
  );
}
