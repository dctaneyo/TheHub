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

// ── Meeting system: in-memory registry of active meetings ──
interface MeetingParticipant {
  odId: string;        // odId = the user's id (location or arl)
  socketId: string;
  name: string;
  userType: "location" | "arl";
  role: "host" | "cohost" | "participant";
  hasVideo: boolean;
  hasAudio: boolean;
  isMuted: boolean;     // muted by host
  handRaised: boolean;
  joinedAt: number;
}

interface ActiveMeeting {
  meetingId: string;
  title: string;
  hostId: string;       // ARL user id who created
  hostName: string;
  createdAt: number;
  participants: Map<string, MeetingParticipant>; // keyed by socketId
}

if (!(globalThis as any).__hubActiveMeetings) {
  (globalThis as any).__hubActiveMeetings = new Map<string, ActiveMeeting>();
}
const _activeMeetings: Map<string, ActiveMeeting> = (globalThis as any).__hubActiveMeetings;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// All date/time helpers use Hawaii time (Pacific/Honolulu) since the server
// runs on Railway (UTC) but all tasks are in Hawaii local time.
function hawaiiNow(): Date {
  // Get current time in Hawaii by formatting in that timezone then parsing
  const str = new Date().toLocaleString("en-US", { timeZone: "Pacific/Honolulu" });
  return new Date(str);
}

function todayStr(): string {
  const d = hawaiiNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayOfWeek(): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][hawaiiNow().getDay()];
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
        const hiNow = hawaiiNow(); hiNow.setHours(0, 0, 0, 0);
        const nd = hiNow.getDay();
        const nowMon = new Date(hiNow);
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
    try { return (JSON.parse(task.recurringDays) as number[]).includes(hawaiiNow().getDate()); } catch { return false; }
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

    const now = hawaiiNow();
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
      try {
        const now = new Date().toISOString();
        if (user.sessionCode) {
          db.update(schema.sessions)
            .set({ lastSeen: now, isOnline: true, socketId: socket.id })
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

    // ══════════════════════════════════════════════════════════
    // ── Meeting System (replaces old one-way broadcast) ──
    // ══════════════════════════════════════════════════════════

    // Helper: serialize participants map for emission
    const serializeParticipants = (meeting: ActiveMeeting) =>
      Array.from(meeting.participants.values()).map(p => ({
        odId: p.odId, socketId: p.socketId, name: p.name,
        userType: p.userType, role: p.role, hasVideo: p.hasVideo,
        hasAudio: p.hasAudio, isMuted: p.isMuted, handRaised: p.handRaised,
      }));

    // Helper: broadcast meeting state to all participants
    const broadcastMeetingState = (meeting: ActiveMeeting) => {
      io!.to(`meeting:${meeting.meetingId}`).emit("meeting:participants-updated", {
        meetingId: meeting.meetingId,
        participants: serializeParticipants(meeting),
      });
    };

    // ── Create meeting (ARL only) ──
    socket.on("meeting:create", (data: { meetingId: string; title: string }) => {
      if (!user || user.userType !== "arl") return;
      const meeting: ActiveMeeting = {
        meetingId: data.meetingId,
        title: data.title,
        hostId: user.id,
        hostName: user.name,
        createdAt: Date.now(),
        participants: new Map(),
      };
      _activeMeetings.set(data.meetingId, meeting);

      // Notify everyone that a meeting started
      io!.to("locations").emit("meeting:started", {
        meetingId: data.meetingId, title: data.title,
        hostName: user.name, hostId: user.id,
      });
      io!.to("arls").emit("meeting:started", {
        meetingId: data.meetingId, title: data.title,
        hostName: user.name, hostId: user.id,
        hostSocketId: socket.id,
      });
      console.log(`📹 Meeting created: "${data.title}" by ${user.name}`);
    });

    // ── Join meeting ──
    socket.on("meeting:join", (data: { meetingId: string; hasVideo: boolean; hasAudio: boolean }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) { socket.emit("meeting:error", { error: "Meeting not found" }); return; }

      const isHost = meeting.hostId === user.id;
      const isArl = user.userType === "arl";
      const participant: MeetingParticipant = {
        odId: user.id,
        socketId: socket.id,
        name: user.name,
        userType: user.userType as "location" | "arl",
        role: isHost ? "host" : (isArl ? "cohost" : "participant"),
        hasVideo: data.hasVideo,
        hasAudio: data.hasAudio,
        isMuted: !isArl, // restaurants start muted, ARLs start unmuted
        handRaised: false,
        joinedAt: Date.now(),
      };
      meeting.participants.set(socket.id, participant);
      socket.join(`meeting:${data.meetingId}`);

      // Tell the joiner about all existing participants (so they can create peer connections)
      const existingParticipants = Array.from(meeting.participants.entries())
        .filter(([sid]) => sid !== socket.id)
        .map(([sid, p]) => ({
          odId: p.odId, socketId: sid, name: p.name,
          userType: p.userType, role: p.role, hasVideo: p.hasVideo,
          hasAudio: p.hasAudio, isMuted: p.isMuted, handRaised: p.handRaised,
        }));
      socket.emit("meeting:joined", {
        meetingId: data.meetingId,
        title: meeting.title,
        hostName: meeting.hostName,
        participants: existingParticipants,
        yourRole: participant.role,
      });

      // Tell all OTHER participants about the new joiner (so they create a peer connection to them)
      socket.to(`meeting:${data.meetingId}`).emit("meeting:participant-joined", {
        meetingId: data.meetingId,
        participant: {
          odId: participant.odId, socketId: socket.id, name: participant.name,
          userType: participant.userType, role: participant.role,
          hasVideo: participant.hasVideo, hasAudio: participant.hasAudio,
          isMuted: participant.isMuted, handRaised: participant.handRaised,
        },
      });
      console.log(`📹 ${user.name} joined meeting "${meeting.title}" as ${participant.role}`);
    });

    // ── Leave meeting ──
    socket.on("meeting:leave", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      meeting.participants.delete(socket.id);
      socket.leave(`meeting:${data.meetingId}`);

      io!.to(`meeting:${data.meetingId}`).emit("meeting:participant-left", {
        meetingId: data.meetingId, socketId: socket.id, name: user.name,
      });

      // If host left and no participants remain, end the meeting
      if (meeting.participants.size === 0) {
        _activeMeetings.delete(data.meetingId);
        io!.to("locations").emit("meeting:ended", { meetingId: data.meetingId });
        io!.to("arls").emit("meeting:ended", { meetingId: data.meetingId });
        console.log(`📹 Meeting "${meeting.title}" ended (empty)`);
      }
    });

    // ── End meeting (host/cohost only) ──
    socket.on("meeting:end", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const p = meeting.participants.get(socket.id);
      if (!p || (p.role !== "host" && p.role !== "cohost")) return;

      io!.to(`meeting:${data.meetingId}`).emit("meeting:ended", { meetingId: data.meetingId });
      io!.to("locations").emit("meeting:ended", { meetingId: data.meetingId });
      io!.to("arls").emit("meeting:ended", { meetingId: data.meetingId });
      _activeMeetings.delete(data.meetingId);
      console.log(`📹 Meeting "${meeting.title}" ended by ${user.name}`);
    });

    // ── Raise hand (restaurant requests to speak) ──
    socket.on("meeting:raise-hand", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const p = meeting.participants.get(socket.id);
      if (!p) return;
      p.handRaised = true;
      io!.to(`meeting:${data.meetingId}`).emit("meeting:hand-raised", {
        meetingId: data.meetingId, socketId: socket.id, name: user.name,
      });
    });

    // ── Lower hand ──
    socket.on("meeting:lower-hand", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const p = meeting.participants.get(socket.id);
      if (!p) return;
      p.handRaised = false;
      io!.to(`meeting:${data.meetingId}`).emit("meeting:hand-lowered", {
        meetingId: data.meetingId, socketId: socket.id,
      });
    });

    // ── Allow speak (host/cohost unmutes a participant) ──
    socket.on("meeting:allow-speak", (data: { meetingId: string; targetSocketId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const me = meeting.participants.get(socket.id);
      if (!me || (me.role !== "host" && me.role !== "cohost")) return;
      const target = meeting.participants.get(data.targetSocketId);
      if (!target) return;
      target.isMuted = false;
      target.handRaised = false;
      // Tell the target they can now speak
      io!.to(data.targetSocketId).emit("meeting:speak-allowed", { meetingId: data.meetingId });
      // Tell everyone about the state change
      broadcastMeetingState(meeting);
    });

    // ── Mute participant (host/cohost mutes someone) ──
    socket.on("meeting:mute-participant", (data: { meetingId: string; targetSocketId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const me = meeting.participants.get(socket.id);
      if (!me || (me.role !== "host" && me.role !== "cohost")) return;
      const target = meeting.participants.get(data.targetSocketId);
      if (!target) return;
      target.isMuted = true;
      io!.to(data.targetSocketId).emit("meeting:you-were-muted", { meetingId: data.meetingId });
      broadcastMeetingState(meeting);
    });

    // ── Update own media state (toggle video/audio) ──
    socket.on("meeting:media-update", (data: { meetingId: string; hasVideo?: boolean; hasAudio?: boolean }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const p = meeting.participants.get(socket.id);
      if (!p) return;
      if (data.hasVideo !== undefined) p.hasVideo = data.hasVideo;
      if (data.hasAudio !== undefined) p.hasAudio = data.hasAudio;
      broadcastMeetingState(meeting);
    });

    // ── Chat message in meeting ──
    socket.on("meeting:chat", (data: { meetingId: string; content: string }) => {
      if (!user) return;
      const msg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        senderName: user.name,
        senderType: user.userType,
        content: data.content,
        timestamp: Date.now(),
      };
      io!.to(`meeting:${data.meetingId}`).emit("meeting:chat-message", msg);
    });

    // ── Reaction in meeting ──
    socket.on("meeting:reaction", (data: { meetingId: string; emoji: string }) => {
      if (!user) return;
      io!.to(`meeting:${data.meetingId}`).emit("meeting:reaction", {
        emoji: data.emoji, senderName: user.name,
      });
    });

    // ── Q&A in meeting ──
    socket.on("meeting:question", (data: { meetingId: string; question: string }) => {
      if (!user) return;
      const q = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        askerName: user.name, question: data.question,
        upvotes: 0, isAnswered: false,
      };
      io!.to(`meeting:${data.meetingId}`).emit("meeting:question", q);
    });

    socket.on("meeting:answer-question", (data: { meetingId: string; questionId: string }) => {
      io!.to(`meeting:${data.meetingId}`).emit("meeting:question-answered", { questionId: data.questionId });
    });

    socket.on("meeting:upvote-question", (data: { meetingId: string; questionId: string }) => {
      io!.to(`meeting:${data.meetingId}`).emit("meeting:question-upvoted", { questionId: data.questionId });
    });

    // ── Get active meetings list ──
    socket.on("meeting:list", () => {
      const meetings = Array.from(_activeMeetings.values()).map(m => ({
        meetingId: m.meetingId, title: m.title,
        hostName: m.hostName, hostId: m.hostId,
        participantCount: m.participants.size,
        createdAt: m.createdAt,
      }));
      socket.emit("meeting:list", { meetings });
    });

    // ── WebRTC Signaling (mesh: peer-to-peer via server relay) ──
    // Any participant can send an offer to any other participant
    socket.on("webrtc:offer", (data: { targetSocketId: string; offer: any }) => {
      io!.to(data.targetSocketId).emit("webrtc:offer", {
        offer: data.offer,
        senderSocketId: socket.id,
      });
    });

    socket.on("webrtc:answer", (data: { targetSocketId: string; answer: any }) => {
      io!.to(data.targetSocketId).emit("webrtc:answer", {
        answer: data.answer,
        senderSocketId: socket.id,
      });
    });

    socket.on("webrtc:ice-candidate", (data: { targetSocketId: string; candidate: any }) => {
      io!.to(data.targetSocketId).emit("webrtc:ice-candidate", {
        candidate: data.candidate,
        senderSocketId: socket.id,
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
        // Clean up meetings: remove from any active meeting
        for (const [meetingId, meeting] of _activeMeetings.entries()) {
          if (meeting.participants.has(socket.id)) {
            meeting.participants.delete(socket.id);
            io!.to(`meeting:${meetingId}`).emit("meeting:participant-left", {
              meetingId, socketId: socket.id, name: user.name,
            });
            // If meeting is now empty, clean it up
            if (meeting.participants.size === 0) {
              _activeMeetings.delete(meetingId);
              io!.to("locations").emit("meeting:ended", { meetingId });
              io!.to("arls").emit("meeting:ended", { meetingId });
            }
          }
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
