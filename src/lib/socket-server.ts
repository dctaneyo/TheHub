import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import type { AuthPayload } from "./auth";
import { db, schema } from "./db";
import { and, eq } from "drizzle-orm";

// Read the build ID written by `npm run build` — the only reliable way
// to pass a build-time value into the custom Node server at runtime.
function readBuildId(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "build-id.txt"), "utf8").trim();
  } catch {
    return "dev";
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "the-hub-secret-key-change-in-production";

// ── Server-side task notification scheduler ──
// Per-location map of active timers: taskId → [dueSoonTimer, overdueTimer]
const _taskTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayOfWeek(): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

function taskAppliesToToday(task: typeof schema.tasks.$inferSelect): boolean {
  const today = todayStr();
  const dow = dayOfWeek();
  if (task.isHidden || !task.showInToday) return false;
  if (!task.isRecurring) return task.dueDate === today;
  if (task.isRecurring && task.createdAt) {
    if (today < task.createdAt.split("T")[0]) return false;
  }
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly" || rType === "biweekly") {
    if (!task.recurringDays) return false;
    try {
      const days = JSON.parse(task.recurringDays) as string[];
      if (!days.includes(dow)) return false;
      if (rType === "biweekly") {
        const anchor = task.createdAt ? new Date(task.createdAt) : new Date(0);
        const anchorMon = new Date(anchor);
        const ad = anchorMon.getDay();
        anchorMon.setDate(anchorMon.getDate() + (ad === 0 ? -6 : 1 - ad));
        anchorMon.setHours(0, 0, 0, 0);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const nd = now.getDay();
        const nowMon = new Date(now);
        nowMon.setDate(nowMon.getDate() + (nd === 0 ? -6 : 1 - nd));
        const weeksDiff = Math.round((nowMon.getTime() - anchorMon.getTime()) / (7 * 86400000));
        const isEven = weeksDiff % 2 === 0;
        return (task as any).biweeklyStart === "next" ? !isEven : isEven;
      }
      return true;
    } catch { return false; }
  }
  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as number[]).includes(new Date().getDate()); } catch { return false; }
  }
  return false;
}

function scheduleTaskNotifications(io: SocketIOServer, locationId: string) {
  // Cancel any existing timers for this location
  const existing = _taskTimers.get(locationId) || [];
  existing.forEach(clearTimeout);
  _taskTimers.set(locationId, []);

  try {
    const allTasks = db.select().from(schema.tasks).all();
    const today = todayStr();
    const completions = db.select({ taskId: schema.taskCompletions.taskId })
      .from(schema.taskCompletions)
      .where(and(eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, today)))
      .all();
    const completedIds = new Set(completions.map((c) => c.taskId));

    const todayTasks = allTasks.filter((t) =>
      (!t.locationId || t.locationId === locationId) &&
      !completedIds.has(t.id) &&
      taskAppliesToToday(t)
    );

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const task of todayTasks) {
      const taskMinutes = timeToMinutes(task.dueTime);

      // Due-soon: 30 minutes before due time
      const dueSoonMinutes = taskMinutes - 30;
      const msUntilDueSoon = (dueSoonMinutes - nowMinutes) * 60 * 1000 - now.getSeconds() * 1000;
      if (msUntilDueSoon > 0) {
        timers.push(setTimeout(() => {
          // Re-check not completed before firing
          const c = db.select({ id: schema.taskCompletions.id }).from(schema.taskCompletions)
            .where(and(eq(schema.taskCompletions.taskId, task.id), eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, todayStr())))
            .get();
          if (!c) {
            io.to(`location:${locationId}`).emit("task:due-soon", { taskId: task.id, title: task.title, dueTime: task.dueTime, points: task.points });
          }
        }, msUntilDueSoon));
      }

      // Overdue: exactly at due time
      const msUntilOverdue = (taskMinutes - nowMinutes) * 60 * 1000 - now.getSeconds() * 1000;
      if (msUntilOverdue > 0) {
        timers.push(setTimeout(() => {
          const c = db.select({ id: schema.taskCompletions.id }).from(schema.taskCompletions)
            .where(and(eq(schema.taskCompletions.taskId, task.id), eq(schema.taskCompletions.locationId, locationId), eq(schema.taskCompletions.completedDate, todayStr())))
            .get();
          if (!c) {
            io.to(`location:${locationId}`).emit("task:overdue", { taskId: task.id, title: task.title, dueTime: task.dueTime, points: task.points });
          }
        }, msUntilOverdue));
      }
    }

    _taskTimers.set(locationId, timers);
    console.log(`⏰ Scheduled ${timers.length} task notification timers for location ${locationId}`);
  } catch (err) {
    console.error("scheduleTaskNotifications error:", err);
  }
}

// Global singleton via globalThis so the io instance is shared between
// the custom server (Node.js module) AND webpack-bundled API routes.
// Without globalThis, API routes get their own module scope where io === null.
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

    // Tell the client which build is running — used for stale-client detection
    socket.emit("build:id", { buildId: BUILD_ID });

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
        // Schedule due-soon / overdue push notifications for this location
        scheduleTaskNotifications(io, user.id);
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

    // ── Self-ping: login screen taps their session ID → highlight it on ARL Remote Login ──
    socket.on("session:self-ping", (data: { pendingId: string; code: string }) => {
      io!.to("arls").emit("session:self-ping", { pendingId: data.pendingId, code: data.code });
    });

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

    // ── Client heartbeat — broadcasts presence + updates lastSeen in DB ──
    socket.on("client:heartbeat", () => {
      if (!user) return;
      io!.to("arls").emit("presence:update", {
        userId: user.id,
        userType: user.userType,
        name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        isOnline: true,
      });
      // Update lastSeen for THIS session only (by sessionCode, not userId)
      // Using userId would revive all old stale sessions for the same user.
      try {
        if (user.sessionCode) {
          const now = new Date().toISOString();
          db.update(schema.sessions)
            .set({ isOnline: true, lastSeen: now })
            .where(eq(schema.sessions.sessionCode, user.sessionCode))
            .run();
          // Ack back to this socket so the session popdown updates without polling
          socket.emit("session:heartbeat-ack", { lastSeen: now, sessionCode: user.sessionCode });
        }
      } catch {}
    });

    // ── Activity tracking (which page/section a user is on) ──
    socket.on("activity:update", (data: { page: string }) => {
      if (!user) return;
      // Persist current page to session so it's available on refresh
      try {
        db.update(schema.sessions)
          .set({ currentPage: data.page })
          .where(eq(schema.sessions.socketId, socket.id))
          .run();
      } catch (err) {
        console.error("Failed to update session currentPage:", err);
      }
      io!.to("arls").emit("activity:update", {
        userId: user.id,
        userType: user.userType,
        name: user.name,
        storeNumber: user.userType === "location" ? user.storeNumber : undefined,
        page: data.page,
      });
    });

    // ── Reschedule task notifications when tasks change (ARL updated tasks) ──
    socket.on("task:updated", () => {
      if (user?.userType === "location") {
        scheduleTaskNotifications(io, user.id);
      }
    });

    // ── Midnight rollover: client detected date change, reschedule timers for new day ──
    socket.on("client:day-reset", () => {
      if (user?.userType === "location") {
        scheduleTaskNotifications(io, user.id);
        // Tell the client to re-fetch tasks for the new day
        socket.emit("task:updated", { locationId: user.id });
      }
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
        // Mark session offline in DB so active sessions list stays accurate
        try {
          db.update(schema.sessions)
            .set({ isOnline: false })
            .where(eq(schema.sessions.userId, user.id))
            .run();
        } catch {}
        // Cancel task notification timers for this location
        if (user.userType === "location") {
          const timers = _taskTimers.get(user.id) || [];
          timers.forEach(clearTimeout);
          _taskTimers.delete(user.id);
        }
        console.log(`🔌 ${user.userType} disconnected: ${user.name} (${socket.id})`);
      }
    });
  });

  console.log("⚡ Socket.io server initialized");
  return io;
}

// ── Helper: emit to specific targets ──

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

// ── Pending force actions (in-memory, survives across module reloads via globalThis) ──
interface ForceAction {
  action: "logout" | "redirect";
  token?: string;
  redirectTo?: string;
}

if (!_g.__hubPendingForceActions) {
  _g.__hubPendingForceActions = new Map<string, ForceAction>();
}
const pendingForceActions: Map<string, ForceAction> = _g.__hubPendingForceActions;

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
