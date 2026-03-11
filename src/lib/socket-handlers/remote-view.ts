import type { Server as SocketIOServer, Socket } from "socket.io";
import type { AuthPayload } from "../auth";
import type { RemoteViewSession, DOMSnapshot, RemoteAction, UserEvent } from "./types";
import { remoteViewSessions, rvDisconnectTimers, RV_DISCONNECT_GRACE_MS } from "./state";
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

    // Emit to session room so all ARL sockets (original + mirror tabs) receive it
    socket.to(`remote-view:${data.sessionId}`).volatile.emit("remote-view:cursor", {
      sessionId: data.sessionId,
      x: data.x,
      y: data.y,
    });
  });

  // ── Mirror Mode: ARL joins target location's task update room ──
  socket.on("mirror:join", (data: { sessionId: string; locationId: string }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // Join the session room so mirror tab receives cursor/click/scroll/device/ended events
    const sessionRoom = `remote-view:${data.sessionId}`;
    socket.join(sessionRoom);

    // Join the location's task update room so the ARL receives task:updated events
    const tp = (socket as any)._tenantPrefix;
    if (tp) {
      socket.join(`${tp}:location:${data.locationId}`);
    }
    socket.join(`location:${data.locationId}`);

    // Re-send device info to the newly joined mirror tab if location is already streaming
    if (session.locationSocketId) {
      const locSocket = io.sockets.sockets.get(session.locationSocketId);
      if (locSocket) {
        locSocket.emit("mirror:request-device-info", { sessionId: data.sessionId });
      }
    }

    console.log(`🪞 Mirror mode: ${user.name} joined session ${data.sessionId} + location ${data.locationId}'s room`);
  });

  // ── Location: Send scroll position (for mirror mode sync) ──
  socket.on("mirror:scroll", (data: { sessionId: string; x: number; y: number; maxY?: number }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // Emit to session room so all ARL sockets (original + mirror tabs) receive it
    socket.to(`remote-view:${data.sessionId}`).volatile.emit("mirror:scroll", {
      sessionId: data.sessionId,
      x: data.x,
      y: data.y,
      maxY: data.maxY,
    });
  });

  // ── ARL (mirror iframe): Send scroll position to target ──
  socket.on("mirror:scroll-from-arl", (data: { sessionId: string; x: number; y: number; maxY?: number }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    if (session.locationSocketId) {
      const locSocket = io.sockets.sockets.get(session.locationSocketId);
      if (locSocket) {
        locSocket.volatile.emit("mirror:scroll-from-arl", {
          sessionId: data.sessionId,
          x: data.x,
          y: data.y,
          maxY: data.maxY,
        });
      }
    }
  });

  // ── Location: Send click event (for mirror mode ripple visualization) ──
  socket.on("mirror:click", (data: { sessionId: string; x: number; y: number }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // Emit to session room
    socket.to(`remote-view:${data.sessionId}`).emit("mirror:click", {
      sessionId: data.sessionId,
      x: data.x,
      y: data.y,
    });
  });

  // ── Location: Send device info (viewport, mobile/desktop, user agent, layout) ──
  socket.on("mirror:device-info", (data: { sessionId: string; device: { width: number; height: number; isMobile: boolean; userAgent: string; layout?: string } }) => {
    if (user.userType !== "location") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // Emit to session room
    socket.to(`remote-view:${data.sessionId}`).emit("mirror:device-info", {
      sessionId: data.sessionId,
      device: data.device,
    });
  });

  // ── Bidirectional view state changes (chat/forms/calendar open, layout) ──
  socket.on("mirror:view-change", (data: { sessionId: string; viewState: { chatOpen?: boolean; formsOpen?: boolean; calendarOpen?: boolean; layout?: string; mobileView?: string } }) => {
    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    if (user.userType === "location") {
      // Location → ARL: emit to session room
      socket.to(`remote-view:${data.sessionId}`).emit("mirror:view-change", {
        sessionId: data.sessionId,
        viewState: data.viewState,
      });
    } else if (user.userType === "arl") {
      // ARL → Location: emit directly to location socket
      if (session.locationSocketId) {
        const locSocket = io.sockets.sockets.get(session.locationSocketId);
        if (locSocket) {
          locSocket.emit("mirror:view-change", {
            sessionId: data.sessionId,
            viewState: data.viewState,
          });
        }
      }
    }
  });

  // ── Mirror mode: ARL cursor relay to target (visible cursor on user's screen) ──
  socket.on("mirror:arl-cursor", (data: { sessionId: string; x: number; y: number; visible: boolean }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    if (session.locationSocketId) {
      const locSocket = io.sockets.sockets.get(session.locationSocketId);
      if (locSocket) {
        locSocket.volatile.emit("mirror:arl-cursor", {
          sessionId: data.sessionId,
          x: data.x,
          y: data.y,
          visible: data.visible,
        });
      }
    }
  });

  // ── Mirror mode: ARL toggles cursor visibility on target ──
  socket.on("mirror:arl-cursor-toggle", (data: { sessionId: string; visible: boolean }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    if (session.locationSocketId) {
      const locSocket = io.sockets.sockets.get(session.locationSocketId);
      if (locSocket) {
        locSocket.emit("mirror:arl-cursor-toggle", {
          sessionId: data.sessionId,
          visible: data.visible,
        });
      }
    }
  });

  // ── Mirror mode: ARL dismisses notifications on behalf of location ──
  socket.on("mirror:dismiss-notifications", (data: { sessionId: string; notificationIds: string[]; locationId: string }) => {
    if (user.userType !== "arl") return;

    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") return;

    // Broadcast dismiss to the location's room so the target receives it
    const tp = (socket as any)._tenantPrefix;
    if (tp) socket.to(`${tp}:location:${data.locationId}`).emit("notification:dismissed", { notificationIds: data.notificationIds });
    socket.to(`location:${data.locationId}`).emit("notification:dismissed", { notificationIds: data.notificationIds });
  });

  // ── Reconnection: user rejoins an active session after socket reconnect ──
  socket.on("remote-view:rejoin", (data: { sessionId: string }) => {
    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status === "ended") {
      socket.emit("remote-view:rejoin-result", { sessionId: data.sessionId, success: false, reason: "session_not_found" });
      return;
    }

    const isArl = user.userType === "arl" && session.arlId === user.id;
    const isLoc = user.userType === "location" && session.locationId === user.id;
    if (!isArl && !isLoc) {
      socket.emit("remote-view:rejoin-result", { sessionId: data.sessionId, success: false, reason: "unauthorized" });
      return;
    }

    // Cancel any pending disconnect timer for this session+side
    const timerKey = `${data.sessionId}:${user.userType}:${user.id}`;
    const existingTimer = rvDisconnectTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      rvDisconnectTimers.delete(timerKey);
      console.log(`🖥️ Reconnect grace timer cancelled for ${user.name} on session ${data.sessionId}`);
    }

    // Update socket ID and rejoin room
    const roomName = `remote-view:${data.sessionId}`;
    socket.join(roomName);

    if (isArl) {
      session.arlSocketId = socket.id;
    } else {
      session.locationSocketId = socket.id;
    }

    // Notify both sides that reconnection succeeded
    io.to(roomName).emit("remote-view:reconnected", {
      sessionId: data.sessionId,
      reconnectedUser: user.name,
      reconnectedUserType: user.userType,
    });

    socket.emit("remote-view:rejoin-result", {
      sessionId: data.sessionId,
      success: true,
      session: {
        sessionId: session.sessionId,
        locationId: session.locationId,
        locationName: session.locationName,
        controlEnabled: session.controlEnabled,
        status: session.status,
      },
    });

    // If location reconnected, request device info refresh for ARL
    if (isLoc) {
      socket.emit("mirror:request-device-info", { sessionId: data.sessionId });
    }

    console.log(`🖥️ ${user.name} rejoined remote view session ${data.sessionId}`);
  });

  // ── Heartbeat: verify session is alive ──
  socket.on("remote-view:heartbeat", (data: { sessionId: string }) => {
    const session = remoteViewSessions.get(data.sessionId);
    if (!session || session.status !== "active") {
      socket.emit("remote-view:heartbeat-ack", { sessionId: data.sessionId, alive: false });
      return;
    }

    const isArl = user.userType === "arl" && session.arlId === user.id;
    const isLoc = user.userType === "location" && session.locationId === user.id;
    if (!isArl && !isLoc) {
      socket.emit("remote-view:heartbeat-ack", { sessionId: data.sessionId, alive: false });
      return;
    }

    // Check that the other side's socket is still connected
    const otherSocketId = isArl ? session.locationSocketId : session.arlSocketId;
    const otherSocket = otherSocketId ? io.sockets.sockets.get(otherSocketId) : null;
    const otherConnected = !!otherSocket?.connected;

    // Check if there's a pending disconnect timer for the other side (they're reconnecting)
    const otherUserId = isArl ? session.locationId : session.arlId;
    const otherUserType = isArl ? "location" : "arl";
    const otherTimerKey = `${data.sessionId}:${otherUserType}:${otherUserId}`;
    const otherReconnecting = rvDisconnectTimers.has(otherTimerKey);

    socket.emit("remote-view:heartbeat-ack", {
      sessionId: data.sessionId,
      alive: true,
      otherConnected,
      otherReconnecting,
    });
  });
}

/**
 * Clean up remote view sessions when a user disconnects.
 * Uses a grace period to allow reconnection.
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
      const timerKey = `${sessionId}:${user.userType}:${user.id}`;

      // Don't create duplicate timers
      if (rvDisconnectTimers.has(timerKey)) continue;

      // Notify the other side that this user is reconnecting
      const roomName = `remote-view:${sessionId}`;
      io.to(roomName).emit("remote-view:reconnecting", {
        sessionId,
        disconnectedUser: user.name,
        disconnectedUserType: user.userType,
        gracePeriodMs: RV_DISCONNECT_GRACE_MS,
      });

      console.log(`🖥️ ${user.name} disconnected from session ${sessionId}, grace period ${RV_DISCONNECT_GRACE_MS}ms started`);

      // Start grace period timer
      const timer = setTimeout(() => {
        rvDisconnectTimers.delete(timerKey);

        // Re-check session still exists and hasn't been rejoined
        const s = remoteViewSessions.get(sessionId);
        if (!s || s.status === "ended") return;

        // Check if the user reconnected (socket ID would have changed)
        const currentSocketId = isArl ? s.arlSocketId : s.locationSocketId;
        const reconnectedSocket = currentSocketId ? io.sockets.sockets.get(currentSocketId) : null;
        if (reconnectedSocket?.connected) {
          // User already reconnected with updated socket — don't end
          console.log(`🖥️ ${user.name} already reconnected to session ${sessionId}, skipping end`);
          return;
        }

        // Grace period expired — end the session
        s.status = "ended";
        const endPayload = {
          sessionId,
          endedBy: user.name,
          endedByType: user.userType,
          reason: "disconnect",
        };
        io.to(roomName).emit("remote-view:ended", endPayload);

        const arlSock = io.sockets.sockets.get(s.arlSocketId);
        const locSock = io.sockets.sockets.get(s.locationSocketId);
        if (arlSock) { arlSock.emit("remote-view:ended", endPayload); arlSock.leave(roomName); }
        if (locSock) { locSock.emit("remote-view:ended", endPayload); locSock.leave(roomName); }

        remoteViewSessions.delete(sessionId);
        console.log(`🖥️ Remote view session ${sessionId} ended after grace period (${user.name} did not reconnect)`);
      }, RV_DISCONNECT_GRACE_MS);

      rvDisconnectTimers.set(timerKey, timer);
    }
  }
}
