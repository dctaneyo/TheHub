import type { Server as SocketIOServer, Socket } from "socket.io";
import type { AuthPayload } from "../auth";
import { activeBroadcasts } from "./state";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export interface ActiveBroadcastState {
  broadcastId: string;
  meetingId: string; // LiveKit meeting ID for the stream
  title: string;
  arlId: string;
  arlName: string;
  tenantId: string;
  startedAt: number;
  viewerCount: number;
}

/**
 * Register broadcast socket handlers.
 *
 * Flow:
 *   1. ARL emits "broadcast:start" → server creates broadcast record,
 *      stores in activeBroadcasts, emits "broadcast:started" to all locations.
 *   2. Locations auto-open the stream viewer on "broadcast:started".
 *   3. ARL emits "broadcast:end" → server marks broadcast ended,
 *      emits "broadcast:ended" to everyone.
 *   4. When a location connects while a broadcast is live, the server
 *      emits "broadcast:started" to that socket immediately (handled in socket-server.ts).
 */
export function registerBroadcastHandlers(
  io: SocketIOServer,
  socket: Socket,
  user: AuthPayload | null,
) {
  if (!user) return;

  // ── ARL starts a broadcast ──
  socket.on("broadcast:start", (data: { title: string; meetingId: string; meetingCode?: string }) => {
    if (user.userType !== "arl") return;

    const tenantId = user.tenantId || "kazi";
    const broadcastId = uuid();

    const state: ActiveBroadcastState = {
      broadcastId,
      meetingId: data.meetingId,
      title: data.title,
      arlId: user.id,
      arlName: user.name,
      tenantId,
      startedAt: Date.now(),
      viewerCount: 0,
    };
    activeBroadcasts.set(broadcastId, state);

    // Persist to DB
    try {
      db.insert(schema.broadcasts).values({
        id: broadcastId,
        tenantId,
        arlId: user.id,
        arlName: user.name,
        title: data.title,
        status: "live",
        streamMode: "video",
        targetAudience: "all",
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }).run();
    } catch (e) {
      console.error("Failed to persist broadcast:", e);
    }

    const payload = {
      broadcastId,
      meetingId: data.meetingId,
      title: data.title,
      arlId: user.id,
      arlName: user.name,
    };

    // Emit to all locations and ARLs (tenant-scoped + legacy)
    const tp = `tenant:${tenantId}`;
    io.to(`${tp}:locations`).emit("broadcast:started", payload);
    io.to(`${tp}:arls`).emit("broadcast:started", payload);
    io.to("locations").emit("broadcast:started", payload);
    io.to("arls").emit("broadcast:started", payload);

    console.log(`📡 Broadcast started: "${data.title}" by ${user.name} (${broadcastId})`);
  });

  // ── ARL ends a broadcast ──
  socket.on("broadcast:end", (data: { broadcastId: string }) => {
    if (user.userType !== "arl") return;

    const state = activeBroadcasts.get(data.broadcastId);
    if (!state) return;
    // Only the ARL who started it (or any ARL from same tenant) can end it
    if (state.arlId !== user.id && state.tenantId !== (user.tenantId || "kazi")) return;

    activeBroadcasts.delete(data.broadcastId);

    // Update DB
    try {
      db.update(schema.broadcasts)
        .set({
          status: "ended",
          endedAt: new Date().toISOString(),
          duration: Math.round((Date.now() - state.startedAt) / 1000),
        })
        .where(eq(schema.broadcasts.id, data.broadcastId))
        .run();
    } catch (e) {
      console.error("Failed to update broadcast end:", e);
    }

    const payload = { broadcastId: data.broadcastId };
    const tp = `tenant:${state.tenantId}`;
    io.to(`${tp}:locations`).emit("broadcast:ended", payload);
    io.to(`${tp}:arls`).emit("broadcast:ended", payload);
    io.to("locations").emit("broadcast:ended", payload);
    io.to("arls").emit("broadcast:ended", payload);

    console.log(`📡 Broadcast ended: "${state.title}" by ${state.arlName}`);
  });

  // ── Location viewer tracking ──
  socket.on("broadcast:viewer-joined", (data: { broadcastId: string }) => {
    const state = activeBroadcasts.get(data.broadcastId);
    if (state) {
      state.viewerCount++;
      // Notify the broadcasting ARL
      const tp = `tenant:${state.tenantId}`;
      io.to(`${tp}:arl:${state.arlId}`).emit("broadcast:viewer-count", {
        broadcastId: data.broadcastId,
        viewerCount: state.viewerCount,
      });
      io.to(`arl:${state.arlId}`).emit("broadcast:viewer-count", {
        broadcastId: data.broadcastId,
        viewerCount: state.viewerCount,
      });
    }
  });

  socket.on("broadcast:viewer-left", (data: { broadcastId: string }) => {
    const state = activeBroadcasts.get(data.broadcastId);
    if (state && state.viewerCount > 0) {
      state.viewerCount--;
      const tp = `tenant:${state.tenantId}`;
      io.to(`${tp}:arl:${state.arlId}`).emit("broadcast:viewer-count", {
        broadcastId: data.broadcastId,
        viewerCount: state.viewerCount,
      });
      io.to(`arl:${state.arlId}`).emit("broadcast:viewer-count", {
        broadcastId: data.broadcastId,
        viewerCount: state.viewerCount,
      });
    }
  });

  // ── List active broadcasts ──
  socket.on("broadcast:list", () => {
    const list = Array.from(activeBroadcasts.values()).map((b) => ({
      broadcastId: b.broadcastId,
      meetingId: b.meetingId,
      title: b.title,
      arlId: b.arlId,
      arlName: b.arlName,
      viewerCount: b.viewerCount,
      startedAt: b.startedAt,
    }));
    socket.emit("broadcast:list", { broadcasts: list });
  });
}

/**
 * Called when a broadcast ARL disconnects — end their broadcast after a grace period.
 */
export function handleBroadcastDisconnect(
  io: SocketIOServer,
  socket: Socket,
  user: AuthPayload | null,
) {
  if (!user || user.userType !== "arl") return;

  // Find any active broadcast by this ARL
  for (const [id, state] of activeBroadcasts) {
    if (state.arlId === user.id) {
      // Grace period: 30 seconds for reconnect
      const timer = setTimeout(() => {
        if (activeBroadcasts.has(id)) {
          activeBroadcasts.delete(id);
          try {
            db.update(schema.broadcasts)
              .set({
                status: "ended",
                endedAt: new Date().toISOString(),
                duration: Math.round((Date.now() - state.startedAt) / 1000),
              })
              .where(eq(schema.broadcasts.id, id))
              .run();
          } catch (e) { console.error("Failed to end broadcast on disconnect:", e); }

          const payload = { broadcastId: id };
          const tp = `tenant:${state.tenantId}`;
          io.to(`${tp}:locations`).emit("broadcast:ended", payload);
          io.to(`${tp}:arls`).emit("broadcast:ended", payload);
          io.to("locations").emit("broadcast:ended", payload);
          io.to("arls").emit("broadcast:ended", payload);
          console.log(`📡 Broadcast auto-ended (ARL disconnected): "${state.title}"`);
        }
      }, 30_000);

      // Store timer so reconnect can cancel it
      (globalThis as any).__hubBroadcastDisconnectTimers =
        (globalThis as any).__hubBroadcastDisconnectTimers || new Map();
      (globalThis as any).__hubBroadcastDisconnectTimers.set(`${id}:${user.id}`, timer);
    }
  }
}

/**
 * Get the current active broadcast for a tenant (if any).
 * Called from socket-server.ts when a location connects.
 */
export function getActiveBroadcastForTenant(tenantId: string): ActiveBroadcastState | null {
  for (const state of activeBroadcasts.values()) {
    if (state.tenantId === tenantId) return state;
  }
  return null;
}
