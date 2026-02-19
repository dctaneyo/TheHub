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
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  emit: () => {},
  joinConversation: () => {},
  leaveConversation: () => {},
  startTyping: () => {},
  stopTyping: () => {},
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

    s.on("session:force-redirect", (data: { token: string; redirectTo: string }) => {
      console.log("🔌 Force redirect received →", data.redirectTo);
      window.location.href = `/api/auth/force-apply?token=${encodeURIComponent(data.token)}&redirect=${encodeURIComponent(data.redirectTo)}`;
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

  return (
    <SocketContext.Provider value={{ socket, isConnected, emit, joinConversation, leaveConversation, startTyping, stopTyping }}>
      {children}
    </SocketContext.Provider>
  );
}
