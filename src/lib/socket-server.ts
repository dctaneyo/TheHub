import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "./auth";

const JWT_SECRET = process.env.JWT_SECRET || "the-hub-secret-key-change-in-production";

// Global singleton so API routes can access the io instance
let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: "*" },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    let user: AuthPayload | null = null;

    // Authenticate on connect
    const token =
      socket.handshake.auth?.token ||
      parseCookie(socket.handshake.headers.cookie || "", "hub-token");

    if (token) {
      try {
        user = jwt.verify(token, JWT_SECRET) as AuthPayload;
      } catch {
        // Invalid token — allow connection but no rooms
      }
    }

    if (user) {
      // Join user-specific room
      if (user.userType === "location") {
        socket.join(`location:${user.id}`);
        socket.join("locations");
      } else {
        socket.join(`arl:${user.id}`);
        socket.join("arls");
      }
      socket.join("all");

      // Store user info on socket
      (socket as any).user = user;

      // Broadcast presence to ARLs
      io!.to("arls").emit("presence:update", {
        userId: user.id,
        userType: user.userType,
        name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        isOnline: true,
      });

      console.log(`🔌 ${user.userType} connected: ${user.name} (${socket.id})`);
    } else {
      // Unauthenticated — login page watcher
      socket.join("login-watchers");
    }

    // ── Join a conversation room ──
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ── Typing indicators ──
    socket.on("typing:start", (data: { conversationId: string }) => {
      if (!user) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
        conversationId: data.conversationId,
        userId: user.id,
        userName: user.name,
        userType: user.userType,
      });
    });

    socket.on("typing:stop", (data: { conversationId: string }) => {
      if (!user) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        conversationId: data.conversationId,
        userId: user.id,
      });
    });

    // ── Disconnect ──
    socket.on("disconnect", () => {
      if (user) {
        io!.to("arls").emit("presence:update", {
          userId: user.id,
          userType: user.userType,
          name: user.name,
          storeNumber: user.userType === "location" ? user.storeNumber : undefined,
          isOnline: false,
        });
        console.log(`🔌 ${user.userType} disconnected: ${user.name} (${socket.id})`);
      }
    });
  });

  console.log("⚡ Socket.io server initialized");
  return io;
}

// ── Helper: emit to specific targets ──

export function emitToAll(event: string, data: any) {
  io?.to("all").emit(event, data);
}

export function emitToLocations(event: string, data: any) {
  io?.to("locations").emit(event, data);
}

export function emitToArls(event: string, data: any) {
  io?.to("arls").emit(event, data);
}

export function emitToLocation(locationId: string, event: string, data: any) {
  io?.to(`location:${locationId}`).emit(event, data);
}

export function emitToArl(arlId: string, event: string, data: any) {
  io?.to(`arl:${arlId}`).emit(event, data);
}

export function emitToConversation(conversationId: string, event: string, data: any) {
  io?.to(`conversation:${conversationId}`).emit(event, data);
}

export function emitToLoginWatchers(event: string, data: any) {
  io?.to("login-watchers").emit(event, data);
}

// Parse a cookie value from a cookie header string
function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
