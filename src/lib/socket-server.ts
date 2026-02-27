import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import type { AuthPayload } from "./auth";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { sendPushToAllARLs } from "./push";
import { createNotificationBulk } from "./notifications";

// ── Modular handler imports ──
import { activeMeetings, pendingForceActions } from "./socket-handlers/state";
import type { ForceAction } from "./socket-handlers/types";
import { registerMeetingHandlers, handleMeetingDisconnect, findActiveMeetingByCode as _findActiveMeetingByCode } from "./socket-handlers/meetings";
import { scheduleTaskNotifications, cancelTaskTimers } from "./socket-handlers/tasks";
import { registerTestHandlers } from "./socket-handlers/tests";

function readBuildId(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "build-id.txt"), "utf8").trim();
  } catch {
    return "dev";
  }
}

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. Cannot start in production without it.");
  }
  return "the-hub-dev-secret-key-local-only";
})();

// Global singleton via globalThis so the io instance is shared between
// the custom server (Node.js module) AND webpack-bundled API routes.
const _g = globalThis as any;

export function getIO(): SocketIOServer | null {
  return _g.__hubSocketIO || null;
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (_g.__hubSocketIO) return _g.__hubSocketIO;

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: "*" },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
  });
  _g.__hubSocketIO = io;

  const BUILD_ID = readBuildId();

  io.on("connection", (socket) => {
    let user: AuthPayload | null = null;

    socket.emit("build:id", { buildId: BUILD_ID });

    // ── Authenticate on connect ──
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

    // Guest auth
    if (!user) {
      const guestName = socket.handshake.auth?.guestName as string | undefined;
      const guestMeetingId = socket.handshake.auth?.guestMeetingId as string | undefined;
      if (guestName && guestMeetingId) {
        user = {
          id: `guest-${socket.id}`,
          userType: "guest",
          userId: "000000",
          name: guestName,
        } as AuthPayload;
        (socket as any)._isGuest = true;
        (socket as any)._guestMeetingId = guestMeetingId;
      }
    }

    if (user) {
      // ── Room joining ──
      if ((socket as any)._isGuest) {
        socket.join("all");
      } else if (user.userType === "location") {
        socket.join(`location:${user.id}`);
        socket.join("locations");
        scheduleTaskNotifications(io, user.id);
      } else {
        socket.join(`arl:${user.id}`);
        socket.join("arls");
      }
      if (!(socket as any)._isGuest) socket.join("all");

      (socket as any).user = user;

      // ── Presence broadcast ──
      if (!(socket as any)._isGuest) {
        io.to("arls").emit("presence:update", {
          userId: user.id,
          userType: user.userType,
          name: user.name,
          storeNumber: user.userType === "location" ? user.storeNumber : undefined,
          isOnline: true,
        });

        if (user.userType === "location") {
          const allArls = db.select().from(schema.arls).where(eq(schema.arls.isActive, true)).all();
          createNotificationBulk(
            allArls.map(arl => arl.id),
            {
              userType: "arl",
              type: "location_online",
              title: `${user.name} is now online`,
              message: `Store #${user.storeNumber || 'N/A'} connected to The Hub`,
              actionUrl: "/arl",
              actionLabel: "View Dashboard",
              priority: "low",
              metadata: { locationId: user.id, locationName: user.name, storeNumber: user.storeNumber },
            }
          ).catch(err => console.error("Failed to create location_online notification:", err));
        }
      }

      // ── Guest meeting auto-join ──
      if ((socket as any)._isGuest) {
        const gMeetingId = (socket as any)._guestMeetingId as string;
        const existingMeeting = activeMeetings.get(gMeetingId);
        const hostIsPresent = existingMeeting && Array.from(existingMeeting.participants.values()).some(p => p.role === "host");

        socket.join(`meeting:${gMeetingId}`);
        console.log(`📹 Guest ${user.name} auto-joined Socket.io room meeting:${gMeetingId}`);

        io.to("arls").emit("meeting:guest-waiting", {
          meetingId: gMeetingId, meetingTitle: gMeetingId,
          guestName: user.name, guestSocketId: socket.id,
        });

        if (!existingMeeting || !hostIsPresent) {
          sendPushToAllARLs({
            title: "Guest Waiting for Meeting",
            body: `${user.name} is waiting for the meeting to start`,
            url: "/arl",
          }).catch(() => {});
        }
      }

      const label = (socket as any)._isGuest ? "guest" : user.userType;
      console.log(`🔌 ${label} connected: ${user.name} (${socket.id})`);

      // ── Notification subscription ──
      socket.on("notification:subscribe", () => {
        if (!(socket as any)._isGuest && user) {
          socket.join(`notifications:${user.id}`);
        }
      });
      socket.on("notification:unsubscribe", () => {
        if (!(socket as any)._isGuest && user) {
          socket.leave(`notifications:${user.id}`);
        }
      });
    } else {
      socket.join("login-watchers");
    }

    // ── Self-ping ──
    socket.on("session:self-ping", (data: { pendingId: string; code: string }) => {
      io.to("arls").emit("session:self-ping", { pendingId: data.pendingId, code: data.code });
    });

    // ── Conversation rooms ──
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
        userId: user.id, userName: user.name, userType: user.userType,
      });
    });
    socket.on("typing:stop", (data: { conversationId: string }) => {
      if (!user) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        conversationId: data.conversationId, userId: user.id,
      });
    });

    // ── Client heartbeat ──
    socket.on("client:heartbeat", () => {
      if (!user) return;
      io.to("arls").emit("presence:update", {
        userId: user.id, userType: user.userType, name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        isOnline: true,
      });
      try {
        const now = new Date().toISOString();
        if (user.sessionCode) {
          db.update(schema.sessions)
            .set({ lastSeen: now, isOnline: true, socketId: socket.id })
            .where(eq(schema.sessions.sessionCode, user.sessionCode))
            .run();
          socket.emit("session:heartbeat-ack", { lastSeen: now, sessionCode: user.sessionCode });
        }
      } catch {}
    });

    // ── Activity tracking ──
    socket.on("activity:update", (data: { page: string }) => {
      if (!user) return;
      try {
        db.update(schema.sessions).set({ currentPage: data.page }).where(eq(schema.sessions.socketId, socket.id)).run();
      } catch (err) { console.error("Failed to update session currentPage:", err); }
      io.to("arls").emit("activity:update", {
        userId: user.id, userType: user.userType, name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        page: data.page,
      });
    });

    // ── Task notification rescheduling ──
    socket.on("task:updated", () => {
      if (user?.userType === "location") scheduleTaskNotifications(io, user.id);
    });
    socket.on("client:day-reset", () => {
      if (user?.userType === "location") {
        scheduleTaskNotifications(io, user.id);
        socket.emit("task:updated", { locationId: user.id });
      }
    });

    // ── Register modular handlers (meetings, tests) ──
    registerMeetingHandlers(io, socket, user);
    registerTestHandlers(io, socket, user);

    // ── Disconnect ──
    socket.on("disconnect", () => {
      if (user) {
        io.to("arls").emit("presence:update", {
          userId: user.id, userType: user.userType, name: user.name,
          storeNumber: user.userType === "location" ? user.storeNumber : undefined,
          isOnline: false,
        });
        try {
          db.update(schema.sessions).set({ isOnline: false }).where(eq(schema.sessions.userId, user.id)).run();
        } catch {}

        if (user.userType === "location") {
          // Delayed offline notification (only if still offline after 5 min)
          const closureUser = user;
          setTimeout(() => {
            const session = db.select().from(schema.sessions).where(eq(schema.sessions.userId, closureUser.id)).get();
            if (session && !session.isOnline) {
              const allArls = db.select().from(schema.arls).where(eq(schema.arls.isActive, true)).all();
              createNotificationBulk(
                allArls.map(arl => arl.id),
                {
                  userType: "arl",
                  type: "location_offline",
                  title: `${closureUser.name} went offline`,
                  message: `Store #${closureUser.storeNumber || 'N/A'} disconnected from The Hub`,
                  actionUrl: "/arl", actionLabel: "View Status", priority: "normal",
                  metadata: { locationId: closureUser.id, locationName: closureUser.name, storeNumber: closureUser.storeNumber },
                }
              ).catch(err => console.error("Failed to create location_offline notification:", err));
            }
          }, 5 * 60 * 1000);

          cancelTaskTimers(user.id);
        }

        // Meeting disconnect cleanup (grace period)
        handleMeetingDisconnect(io, socket, user);

        console.log(`🔌 ${user.userType} disconnected: ${user.name} (${socket.id})`);
      }
    });
  });

  console.log("⚡ Socket.io server initialized");
  return io;
}

// ── Re-export meeting lookup for API routes ──
export { _findActiveMeetingByCode as findActiveMeetingByCode };

// ── Emit helpers ──

export function emitToAll(event: string, data: any) {
  getIO()?.to("all").emit(event, data);
}

export function emitToLocations(event: string, data: any) {
  getIO()?.to("locations").emit(event, data);
}

export function emitToArls(event: string, data: any) {
  getIO()?.to("arls").emit(event, data);
}

export function emitToLocation(locationId: string, event: string, data: any) {
  getIO()?.to(`location:${locationId}`).emit(event, data);
}

export function emitToArl(arlId: string, event: string, data: any) {
  getIO()?.to(`arl:${arlId}`).emit(event, data);
}

export function emitToConversation(conversationId: string, event: string, data: any) {
  getIO()?.to(`conversation:${conversationId}`).emit(event, data);
}

export function emitToLoginWatchers(event: string, data: any) {
  getIO()?.to("login-watchers").emit(event, data);
}

// Parse a cookie value from a cookie header string
function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// ── Pending force actions ──

export function setPendingForceAction(sessionToken: string, forceAction: ForceAction) {
  pendingForceActions.set(sessionToken, forceAction);
}

export function consumePendingForceAction(sessionToken: string): ForceAction | null {
  const action = pendingForceActions.get(sessionToken);
  if (action) {
    pendingForceActions.delete(sessionToken);
    return action;
  }
  return null;
}
