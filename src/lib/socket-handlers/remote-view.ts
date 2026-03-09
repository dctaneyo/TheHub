import type { Server as SocketIOServer, Socket } from "socket.io";
import type { AuthPayload } from "../auth";
import type { RemoteViewSession, DOMSnapshot, RemoteAction, UserEvent } from "./types";
import { remoteViewSessions } from "./state";
import { db, schema } from "../db";
import { eq, and, desc } from "drizzle-orm";

/**
 * Register remote view/control socket event handlers.
 * Flow:
 *   1. ARL requests remote view of a location → server creates pending session
 *   2. Location receives request → user sees consent banner → accepts/rejects
 *   3. On accept, location starts streaming DOM snapshots + user events
 *   4. ARL can toggle control mode and send remote actions
 *   5. Either side can end the session
 */
export function registerRemoteViewHandlers(
  io: SocketIOServer,
  socket: Socket,
  user: AuthPayload | null
) {
  if (!user) return;

  // ── ARL: Request remote view of a location ──
  // ARLs/Admins do NOT need permission — session is auto-accepted.
  // The location client receives "remote-view:start" and begins streaming.
  socket.on("remote-view:request", (data: { locationId: string }) => {
    if (user.userType !== "arl") return;

    const sessionId = `rv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: RemoteViewSession = {
      sessionId,
      locationId: data.locationId,
      locationName: "",
      arlId: user.id,
      arlName: user.name,
      arlSocketId: socket.id,
      locationSocketId: "",
      status: "active", // auto-accepted
      controlEnabled: false,
      startedAt: Date.now(),
    };
    remoteViewSessions.set(sessionId, session);

    // Join the ARL to the session room
    const roomName = `remote-view:${sessionId}`;
    socket.join(roomName);

    // Find the most recently active socket for this location.
    // If a location has multiple sessions (tabs/kiosks), only target one.
    const startPayload = { sessionId, arlId: user.id, arlName: user.name };
    let targeted = false;
    try {
      const latestSession = db.select()
        .from(schema.sessions)
        .where(and(
          eq(schema.sessions.userId, data.locationId),
          eq(schema.sessions.userType, "location"),
          eq(schema.sessions.isOnline, true)
        ))
        .orderBy(desc(schema.sessions.lastSeen))
        .limit(1)
        .get();

      if (latestSession?.socketId) {
        const targetSocket = io.sockets.sockets.get(latestSession.socketId);
        if (targetSocket) {
          targetSocket.emit("remote-view:start", startPayload);
          targetSocket.join(roomName); // Join location to room so it receives ended events
          session.locationSocketId = latestSession.socketId;
          targeted = true;
        }
      }
    } catch {}

    // Fallback: broadcast to all sockets in the location room
    if (!targeted) {
      const tp = (socket as any)._tenantPrefix;
      if (tp) io.to(`${tp}:location:${data.locationId}`).emit("remote-view:start", startPayload);
      io.to(`location:${data.locationId}`).emit("remote-view:start", startPayload);
    }

    // Notify ARL that session is now active (skip pending state)
    socket.emit("remote-view:requested", { sessionId, locationId: data.locationId });
    socket.emit("remote-view:accepted", {
      sessionId,
      locationId: data.locationId,
      locationName: data.locationId, // will be updated once location starts streaming
    });

    console.log(`🖥️ Remote view auto-accepted: ${user.name} → location ${data.locationId}`);
  });

  // ── Location: Accept remote view request ──
  socket.on("remote-view:accept", (data: { sessionId: string }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.locationId !== user.id) return;

    session.status = "active";
    session.locationSocketId = socket.id;
    session.locationName = user.name;

    // Join both sides to a shared room
    const roomName = `remote-view:${data.sessionId}`;
    socket.join(roomName);

    // Notify the ARL
    const arlSockets = io.sockets.sockets;
    const arlSocket = arlSockets.get(session.arlSocketId);
    if (arlSocket) {
      arlSocket.join(roomName);
      arlSocket.emit("remote-view:accepted", {
        sessionId: data.sessionId,
        locationId: user.id,
        locationName: user.name,
      });
    }

    console.log(`🖥️ Remote view accepted: ${user.name} → ARL ${session.arlName}`);
  });

  // ── Location: Reject remote view request ──
  socket.on("remote-view:reject", (data: { sessionId: string }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.locationId !== user.id) return;

    session.status = "ended";
    remoteViewSessions.delete(data.sessionId);

    // Notify the ARL
    const arlSocket = io.sockets.sockets.get(session.arlSocketId);
    if (arlSocket) {
      arlSocket.emit("remote-view:rejected", {
        sessionId: data.sessionId,
        locationId: user.id,
        locationName: user.name,
      });
    }

    console.log(`🖥️ Remote view rejected by ${user.name}`);
  });

  // ── Location: Send DOM snapshot ──
  socket.on("remote-view:snapshot", (data: { sessionId: string; snapshot: DOMSnapshot }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // First snapshot — fill in location details and join room
    if (!session.locationSocketId) {
      session.locationSocketId = socket.id;
      session.locationName = user.name;
      const roomName = `remote-view:${data.sessionId}`;
      socket.join(roomName);
    }

    // Forward snapshot to ARL only (not back to location)
    const arlSocket = io.sockets.sockets.get(session.arlSocketId);
    if (arlSocket) {
      arlSocket.emit("remote-view:snapshot", {
        sessionId: data.sessionId,
        snapshot: data.snapshot,
      });
    }
  });

  // ── Location: Send user event (touch, click, scroll) ──
  socket.on("remote-view:user-event", (data: { sessionId: string; event: UserEvent }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    if (!session.locationSocketId) {
      session.locationSocketId = socket.id;
      session.locationName = user.name;
      socket.join(`remote-view:${data.sessionId}`);
    }

    const arlSocket = io.sockets.sockets.get(session.arlSocketId);
    if (arlSocket) {
      arlSocket.emit("remote-view:user-event", {
        sessionId: data.sessionId,
        event: data.event,
      });
    }
  });

  // ── ARL: Send remote action to location ──
  socket.on("remote-view:action", (data: { sessionId: string; action: RemoteAction }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active" || !session.controlEnabled) return;

    // Forward action to the location
    const locSocket = io.sockets.sockets.get(session.locationSocketId);
    if (locSocket) {
      locSocket.emit("remote-view:action", {
        sessionId: data.sessionId,
        action: data.action,
        arlName: user.name,
      });
    }
  });

  // ── ARL: Toggle control mode ──
  socket.on("remote-view:toggle-control", (data: { sessionId: string; enabled: boolean }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    session.controlEnabled = data.enabled;

    // Notify both sides
    const roomName = `remote-view:${data.sessionId}`;
    io.to(roomName).emit("remote-view:control-toggled", {
      sessionId: data.sessionId,
      enabled: data.enabled,
      arlName: user.name,
    });

    console.log(`🖥️ Remote control ${data.enabled ? "enabled" : "disabled"} by ${user.name}`);
  });

  // ── Either side: End remote view session ──
  socket.on("remote-view:end", (data: { sessionId: string }) => {
    const session = remoteViewSessions.get(data.sessionId);
    if (!session) return;

    // Only the ARL or the location in this session can end it
    if (user.userType === "arl" && session.arlId !== user.id) return;
    if (user.userType === "location" && session.locationId !== user.id) return;

    session.status = "ended";

    const endPayload = {
      sessionId: data.sessionId,
      endedBy: user.name,
      endedByType: user.userType,
    };

    const roomName = `remote-view:${data.sessionId}`;
    io.to(roomName).emit("remote-view:ended", endPayload);

    // Also emit directly to both sockets as a fallback
    const arlSocket = io.sockets.sockets.get(session.arlSocketId);
    const locSocket = io.sockets.sockets.get(session.locationSocketId);
    if (arlSocket) { arlSocket.emit("remote-view:ended", endPayload); arlSocket.leave(roomName); }
    if (locSocket) { locSocket.emit("remote-view:ended", endPayload); locSocket.leave(roomName); }

    remoteViewSessions.delete(data.sessionId);

    console.log(`🖥️ Remote view ended by ${user.name}`);
  });

  // ── ARL: List active remote view sessions ──
  socket.on("remote-view:list", () => {
    if (user.userType !== "arl") return;

    const sessions = Array.from(remoteViewSessions.values())
      .filter(s => s.arlId === user.id && s.status !== "ended")
      .map(s => ({
        sessionId: s.sessionId,
        locationId: s.locationId,
        locationName: s.locationName,
        status: s.status,
        controlEnabled: s.controlEnabled,
        startedAt: s.startedAt,
      }));

    socket.emit("remote-view:list", { sessions });
  });

  // ── Location: Send cursor/touch position (high frequency, lightweight) ──
  socket.on("remote-view:cursor", (data: { sessionId: string; x: number; y: number }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // Fill in location socket on first cursor event too
    if (!session.locationSocketId) {
      session.locationSocketId = socket.id;
      session.locationName = user.name;
      socket.join(`remote-view:${data.sessionId}`);
    }

    const arlSocket = io.sockets.sockets.get(session.arlSocketId);
    if (arlSocket) {
      arlSocket.volatile.emit("remote-view:cursor", {
        sessionId: data.sessionId,
        x: data.x,
        y: data.y,
      });
    }
  });
}

/**
 * Clean up remote view sessions when a user disconnects.
 */
export function handleRemoteViewDisconnect(
  io: SocketIOServer,
  socket: Socket,
  user: AuthPayload
) {
  for (const [sessionId, session] of remoteViewSessions) {
    if (session.status === "ended") continue;

    const isArl = user.userType === "arl" && session.arlId === user.id;
    const isLoc = user.userType === "location" && session.locationId === user.id;

    if (isArl || isLoc) {
      session.status = "ended";
      const endPayload = {
        sessionId,
        endedBy: user.name,
        endedByType: user.userType,
        reason: "disconnect",
      };
      const roomName = `remote-view:${sessionId}`;
      io.to(roomName).emit("remote-view:ended", endPayload);

      // Also emit directly to both sockets as a fallback
      const arlSock = io.sockets.sockets.get(session.arlSocketId);
      const locSock = io.sockets.sockets.get(session.locationSocketId);
      if (arlSock) { arlSock.emit("remote-view:ended", endPayload); arlSock.leave(roomName); }
      if (locSock) { locSock.emit("remote-view:ended", endPayload); locSock.leave(roomName); }

      remoteViewSessions.delete(sessionId);
    }
  }
}
