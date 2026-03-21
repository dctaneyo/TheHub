import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { getJwtSecret, type AuthPayload } from "./auth";
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
import { registerRemoteViewHandlers, handleRemoteViewDisconnect } from "./socket-handlers/remote-view";
import { registerBroadcastHandlers, handleBroadcastDisconnect, getActiveBroadcastForTenant } from "./socket-handlers/broadcasts";

function readBuildId(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "build-id.txt"), "utf8").trim();
  } catch {
    return "dev";
  }
}

// Global singleton via globalThis so the io instance is shared between
// the custom server (Node.js module) AND webpack-bundled API routes.
const _g = globalThis as any;

export function getIO(): SocketIOServer | null {
  return _g.__hubSocketIO || null;
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (_g.__hubSocketIO) return _g.__hubSocketIO;

  // Build allowed origins for CORS — restrict in production, allow localhost in dev
  const allowedOrigins: (string | RegExp)[] = [
    /\.meetthehub\.com$/,
    /\.meethehub\.com$/,
    "https://meetthehub.com",
    "https://meethehub.com",
  ];
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: allowedOrigins, credentials: true },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 5e6, // 5MB — needed for remote view screenshots
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
        user = jwt.verify(token, getJwtSecret()) as AuthPayload;
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
          tenantId: "guest",
          userType: "guest",
          userId: "000000",
          name: guestName,
        } as AuthPayload;
        (socket as any)._isGuest = true;
        (socket as any)._guestMeetingId = guestMeetingId;
      }
    }

    if (user) {
      // ── Tenant-scoped room prefix ──
      const tenantId = user.tenantId || "kazi";
      const tp = `tenant:${tenantId}`; // tenant prefix for rooms
      (socket as any)._tenantPrefix = tp;
      (socket as any)._tenantId = tenantId;

      // ── Room joining ──
      if ((socket as any)._isGuest) {
        socket.join("all"); // guests are cross-tenant (meetings)
      } else if (user.userType === "location") {
        socket.join(`${tp}:location:${user.id}`);
        socket.join(`${tp}:locations`);
        socket.join(`location:${user.id}`); // keep legacy room for backwards compat
        socket.join("locations"); // legacy
        scheduleTaskNotifications(io, user.id);

        // If there's an active broadcast, notify this location immediately
        const activeBroadcast = getActiveBroadcastForTenant(tenantId);
        if (activeBroadcast) {
          socket.emit("broadcast:started", {
            broadcastId: activeBroadcast.broadcastId,
            meetingId: activeBroadcast.meetingId,
            title: activeBroadcast.title,
            arlId: activeBroadcast.arlId,
            arlName: activeBroadcast.arlName,
          });
        }
      } else {
        socket.join(`${tp}:arl:${user.id}`);
        socket.join(`${tp}:arls`);
        socket.join(`arl:${user.id}`); // legacy
        socket.join("arls"); // legacy
      }
      if (!(socket as any)._isGuest) {
        socket.join(`${tp}:all`);
        socket.join("all"); // legacy
      }

      (socket as any).user = user;

      // ── Presence broadcast (tenant-scoped + legacy) ──
      if (!(socket as any)._isGuest) {
        const presenceData = {
          userId: user.id,
          userType: user.userType,
          name: user.name,
          storeNumber: user.userType === "location" ? user.storeNumber : undefined,
          isOnline: true,
        };
        io.to(`${tp}:arls`).emit("presence:update", presenceData);
        io.to("arls").emit("presence:update", presenceData);

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

        const gtp = (socket as any)._tenantPrefix;
        if (gtp) io.to(`${gtp}:arls`).emit("meeting:guest-waiting", {
          meetingId: gMeetingId, meetingTitle: gMeetingId,
          guestName: user.name, guestSocketId: socket.id,
        });
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
      const tp = (socket as any)._tenantPrefix;
      if (tp) io.to(`${tp}:arls`).emit("session:self-ping", { pendingId: data.pendingId, code: data.code });
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
      const tp = (socket as any)._tenantPrefix;
      const presenceData = {
        userId: user.id, userType: user.userType, name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        isOnline: true,
      };
      if (tp) io.to(`${tp}:arls`).emit("presence:update", presenceData);
      io.to("arls").emit("presence:update", presenceData);
      try {
        const now = new Date().toISOString();
        if (user.sessionCode) {
          db.update(schema.sessions)
            .set({ lastSeen: now, isOnline: true, socketId: socket.id })
            .where(eq(schema.sessions.sessionCode, user.sessionCode))
            .run();
          socket.emit("session:heartbeat-ack", { lastSeen: now, sessionCode: user.sessionCode });
        }
      } catch (err) { console.error("Heartbeat update error:", err); }
    });

    // ── Activity tracking ──
    socket.on("activity:update", (data: { page: string }) => {
      if (!user) return;
      try {
        db.update(schema.sessions).set({ currentPage: data.page }).where(eq(schema.sessions.socketId, socket.id)).run();
      } catch (err) { console.error("Failed to update session currentPage:", err); }
      const atp = (socket as any)._tenantPrefix;
      const actData = {
        userId: user.id, userType: user.userType, name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        page: data.page,
      };
      if (atp) io.to(`${atp}:arls`).emit("activity:update", actData);
      io.to("arls").emit("activity:update", actData);
    });

    // ── Notification dismiss sync (same-location cross-kiosk only) ──
    socket.on("notification:dismiss", (data: { notificationIds: string[]; locationId?: string }) => {
      if (!user || user.userType !== "location") return;
      const locId = data.locationId || user.id;
      const ntp = (socket as any)._tenantPrefix;
      // Broadcast only to OTHER sockets in the same location room (exclude sender)
      if (ntp) socket.to(`${ntp}:location:${locId}`).emit("notification:dismissed", { notificationIds: data.notificationIds });
      socket.to(`location:${locId}`).emit("notification:dismissed", { notificationIds: data.notificationIds });
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

    // ── Register modular handlers (meetings, tests, remote-view, broadcasts) ──
    registerMeetingHandlers(io, socket, user);
    registerTestHandlers(io, socket, user);
    registerRemoteViewHandlers(io, socket, user);
    registerBroadcastHandlers(io, socket, user);

    // ── Disconnect ──
    socket.on("disconnect", () => {
      if (user) {
        const dtp = (socket as any)._tenantPrefix;
        const offlineData = {
          userId: user.id, userType: user.userType, name: user.name,
          storeNumber: user.userType === "location" ? user.storeNumber : undefined,
          isOnline: false,
        };
        if (dtp) io.to(`${dtp}:arls`).emit("presence:update", offlineData);
        io.to("arls").emit("presence:update", offlineData);
        try {
          db.update(schema.sessions).set({ isOnline: false }).where(eq(schema.sessions.userId, user.id)).run();
        } catch (err) { console.error("Disconnect session update error:", err); }

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

        // Broadcast disconnect cleanup (grace period)
        handleBroadcastDisconnect(io, socket, user);

        // Remote view disconnect cleanup
        handleRemoteViewDisconnect(io, socket, user);

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
// Each helper emits to BOTH tenant-scoped and legacy rooms so events
// reach all connected sockets regardless of which rooms they joined.
// Once all clients connect with tenant context, the legacy rooms can be removed.

export function emitToAll(event: string, data: any, tenantId?: string) {
  const io = getIO();
  if (!io) return;
  if (tenantId) io.to(`tenant:${tenantId}:all`).emit(event, data);
  io.to("all").emit(event, data);
}

export function emitToLocations(event: string, data: any, tenantId?: string) {
  const io = getIO();
  if (!io) return;
  if (tenantId) io.to(`tenant:${tenantId}:locations`).emit(event, data);
  io.to("locations").emit(event, data);
}

export function emitToArls(event: string, data: any, tenantId?: string) {
  const io = getIO();
  if (!io) return;
  if (tenantId) io.to(`tenant:${tenantId}:arls`).emit(event, data);
  io.to("arls").emit(event, data);
}

export function emitToLocation(locationId: string, event: string, data: any, tenantId?: string) {
  const io = getIO();
  if (!io) return;
  if (tenantId) io.to(`tenant:${tenantId}:location:${locationId}`).emit(event, data);
  io.to(`location:${locationId}`).emit(event, data);
}

export function emitToArl(arlId: string, event: string, data: any, tenantId?: string) {
  const io = getIO();
  if (!io) return;
  if (tenantId) io.to(`tenant:${tenantId}:arl:${arlId}`).emit(event, data);
  io.to(`arl:${arlId}`).emit(event, data);
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
