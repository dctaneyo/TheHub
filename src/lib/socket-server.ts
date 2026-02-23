import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import type { AuthPayload } from "./auth";
import { db, schema } from "./db";
import { and, eq } from "drizzle-orm";
import { sendPushToAllARLs } from "./push";

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
  livekitIdentity?: string; // LiveKit identity (for guests: guest-timestamp-random)
  name: string;
  userType: "location" | "arl" | "guest";
  role: "host" | "cohost" | "participant";
  hasVideo: boolean;
  hasAudio: boolean;
  isMuted: boolean;     // muted by host
  handRaised: boolean;
  joinedAt: number;
}

interface ActiveMeeting {
  meetingId: string;
  instanceId: string;   // unique ID for this session (allows reusing same meetingId)
  title: string;
  hostId: string;       // ARL user id who created
  hostName: string;
  createdAt: number;
  participants: Map<string, MeetingParticipant>; // keyed by socketId
  hostLeftAt?: number;          // timestamp when host left (for auto-end countdown)
  hostLeftTimer?: ReturnType<typeof setTimeout>; // 10-min auto-end timer
}

if (!(globalThis as any).__hubActiveMeetings) {
  (globalThis as any).__hubActiveMeetings = new Map<string, ActiveMeeting>();
}
const _activeMeetings: Map<string, ActiveMeeting> = (globalThis as any).__hubActiveMeetings;

// Grace period timers for disconnected participants (prevent premature removal on brief disconnects)
if (!(globalThis as any).__hubDisconnectTimers) {
  (globalThis as any).__hubDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
}
const _disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = (globalThis as any).__hubDisconnectTimers;

// ── Meeting analytics tracking ──
interface MeetingAnalyticsData {
  meetingId: string;
  analyticsId: string;
  participantRecords: Map<string, string>; // socketId -> participant analytics record ID
  messageCount: number;
  questionCount: number;
  reactionCount: number;
  handRaiseCount: number;
  peakParticipants: number;
}

if (!(globalThis as any).__hubMeetingAnalytics) {
  (globalThis as any).__hubMeetingAnalytics = new Map<string, MeetingAnalyticsData>();
}
const _meetingAnalytics: Map<string, MeetingAnalyticsData> = (globalThis as any).__hubMeetingAnalytics;

// Host-leave auto-end timers (10 minutes)
if (!(globalThis as any).__hubHostLeftTimers) {
  (globalThis as any).__hubHostLeftTimers = new Map<string, ReturnType<typeof setTimeout>>();
}
const _hostLeftTimers: Map<string, ReturnType<typeof setTimeout>> = (globalThis as any).__hubHostLeftTimers;

const HOST_LEFT_AUTO_END_MS = 10 * 60 * 1000; // 10 minutes
const HOST_LEFT_WARNING_INTERVALS = [5 * 60, 2 * 60, 60, 30, 10]; // seconds remaining to send warnings

// ── Force-end a meeting (reusable by multiple triggers) ──
function forceEndMeeting(meetingId: string, reason: string) {
  const io = getIO();
  if (!io) return;
  const meeting = _activeMeetings.get(meetingId);
  if (!meeting) return;

  // Cancel host-left timer if any
  const hostTimer = _hostLeftTimers.get(meetingId);
  if (hostTimer) { clearTimeout(hostTimer); _hostLeftTimers.delete(meetingId); }

  // Finalize analytics
  const analytics = _meetingAnalytics.get(meetingId);
  if (analytics) {
    const duration = Math.round((Date.now() - meeting.createdAt) / 1000);
    try {
      for (const [sid, participant] of meeting.participants) {
        const recordId = analytics.participantRecords.get(sid);
        if (recordId) {
          const pDuration = Math.round((Date.now() - participant.joinedAt) / 1000);
          db.update(schema.meetingParticipants)
            .set({ leftAt: new Date().toISOString(), duration: pDuration })
            .where(eq(schema.meetingParticipants.id, recordId)).run();
        }
      }
      db.update(schema.meetingAnalytics).set({
        endedAt: new Date().toISOString(),
        duration,
        totalMessages: analytics.messageCount,
        totalQuestions: analytics.questionCount,
        totalReactions: analytics.reactionCount,
        totalHandRaises: analytics.handRaiseCount,
        peakParticipants: analytics.peakParticipants,
      }).where(eq(schema.meetingAnalytics.id, analytics.analyticsId)).run();
    } catch (e) { console.error('Analytics force-end error:', e); }
    _meetingAnalytics.delete(meetingId);
  }

  // Cancel all disconnect grace timers for this meeting's participants
  for (const [sid] of meeting.participants) {
    const timerKey = `${meetingId}:${sid}`;
    const timer = _disconnectTimers.get(timerKey);
    if (timer) { clearTimeout(timer); _disconnectTimers.delete(timerKey); }
  }

  io.to(`meeting:${meetingId}`).emit("meeting:ended", { meetingId, reason });
  io.to("locations").emit("meeting:ended", { meetingId });
  io.to("arls").emit("meeting:ended", { meetingId });
  io.to("all").emit("meeting:ended", { meetingId }); // Include guests
  _activeMeetings.delete(meetingId);
  
  // Broadcast updated meeting list to all ARLs
  const remainingMeetings = Array.from(_activeMeetings.values()).map(m => ({
    meetingId: m.meetingId, title: m.title,
    hostName: m.hostName, hostId: m.hostId,
    participantCount: m.participants.size,
    createdAt: m.createdAt,
  }));
  io.to("arls").emit("meeting:list", { meetings: remainingMeetings });
  
  console.log(`📹 Meeting "${meeting.title}" force-ended: ${reason}`);
}

// ── Periodic stale meeting cleanup (every 60s) ──
if (!(globalThis as any).__hubMeetingCleanupInterval) {
  (globalThis as any).__hubMeetingCleanupInterval = setInterval(() => {
    const io = getIO();
    if (!io) return;
    for (const [meetingId, meeting] of _activeMeetings.entries()) {
      // End meetings with no participants
      if (meeting.participants.size === 0) {
        forceEndMeeting(meetingId, "No participants remaining");
        continue;
      }
      // End meetings older than 4 hours (safety net)
      if (Date.now() - meeting.createdAt > 4 * 60 * 60 * 1000) {
        forceEndMeeting(meetingId, "Meeting exceeded 4-hour maximum duration");
        continue;
      }
    }
  }, 60_000);
}

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

    // Guest auth: if no JWT but handshake has guest info, create a virtual guest user
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
      // Join user-specific room
      if ((socket as any)._isGuest) {
        // Guests only join the "all" room — no location/arl rooms
        socket.join("all");
      } else if (user.userType === "location") {
        socket.join(`location:${user.id}`);
        socket.join("locations");
        // Schedule due-soon / overdue push notifications for this location
        scheduleTaskNotifications(io, user.id);
      } else {
        socket.join(`arl:${user.id}`);
        socket.join("arls");
      }
      if (!(socket as any)._isGuest) socket.join("all");

      // Store user info on socket
      (socket as any).user = user;

      // Broadcast presence to ARLs (not for guests)
      if (!(socket as any)._isGuest) {
        io!.to("arls").emit("presence:update", {
          userId: user.id,
          userType: user.userType,
          name: user.name,
          storeNumber: user.userType === "location" ? user.storeNumber : undefined,
          isOnline: true,
        });
      }

      // Notify ARLs when a guest connects — only if meeting hasn't started or host isn't present
      if ((socket as any)._isGuest) {
        const gMeetingId = (socket as any)._guestMeetingId as string;
        const existingMeeting = _activeMeetings.get(gMeetingId);
        const hostIsPresent = existingMeeting && Array.from(existingMeeting.participants.values()).some(p => p.role === "host");

        // Auto-join guest to the meeting Socket.io room so they receive broadcasts
        // This is needed because guest clients may have timing issues with meeting:join
        socket.join(`meeting:${gMeetingId}`);
        console.log(`📹 Guest ${user.name} auto-joined Socket.io room meeting:${gMeetingId}`);

        io!.to("arls").emit("meeting:guest-waiting", {
          meetingId: gMeetingId,
          meetingTitle: gMeetingId,
          guestName: user.name,
          guestSocketId: socket.id,
        });

        // Only send push notification if the meeting hasn't started or host isn't in the meeting
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
      
      // If a meeting with this ID already exists, force-end it first (handles recurring meetings)
      const existingMeeting = _activeMeetings.get(data.meetingId);
      if (existingMeeting) {
        console.log(`📹 Meeting ${data.meetingId} already exists — ending previous instance before creating new one`);
        forceEndMeeting(data.meetingId, "New meeting session started with same ID");
      }
      
      const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const hostParticipant: MeetingParticipant = {
        odId: user.id,
        socketId: socket.id,
        name: user.name,
        userType: "arl",
        role: "host",
        hasVideo: true,
        hasAudio: true,
        isMuted: false,
        handRaised: false,
        joinedAt: Date.now(),
      };
      const meeting: ActiveMeeting = {
        meetingId: data.meetingId,
        instanceId,
        title: data.title,
        hostId: user.id,
        hostName: user.name,
        createdAt: Date.now(),
        participants: new Map([[socket.id, hostParticipant]]),
      };
      _activeMeetings.set(data.meetingId, meeting);
      console.log(`📹 Created meeting ${data.meetingId} (instance: ${instanceId})`);
      socket.join(`meeting:${data.meetingId}`);

      // Create analytics record (wrapped in try/catch so notification still fires on DB error)
      const analyticsId = crypto.randomUUID();
      try {
        db.insert(schema.meetingAnalytics).values({
          id: analyticsId,
          meetingId: data.meetingId,
          title: data.title,
          hostId: user.id,
          hostName: user.name,
          totalParticipants: 1,
          totalArls: 1,
          peakParticipants: 1,
        }).run();
        _meetingAnalytics.set(data.meetingId, {
          meetingId: data.meetingId,
          analyticsId,
          participantRecords: new Map(),
          messageCount: 0,
          questionCount: 0,
          reactionCount: 0,
          handRaiseCount: 0,
          peakParticipants: 1,
        });
      } catch (e) {
        console.error('Analytics create error:', e);
      }

      // Notify everyone that a meeting started (including guests in "all" room)
      const startedPayload = {
        meetingId: data.meetingId, title: data.title,
        hostName: user.name, hostId: user.id,
        hostSocketId: socket.id,
      };
      io!.to("locations").emit("meeting:started", startedPayload);
      io!.to("arls").emit("meeting:started", startedPayload);
      io!.to("all").emit("meeting:started", startedPayload);
      console.log(`📹 Meeting created: "${data.title}" by ${user.name}`);
    });

    // ── Join meeting ──
    socket.on("meeting:join", (data: { meetingId: string; hasVideo: boolean; hasAudio: boolean; livekitIdentity?: string }) => {
      console.log(`📹 meeting:join received from ${user?.name || 'unknown'} (${socket.id}) for meeting ${data.meetingId}, lkIdentity=${data.livekitIdentity}`);
      if (!user) {
        console.log(`📹 meeting:join rejected: no user`);
        return;
      }
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) { 
        console.log(`📹 meeting:join rejected: meeting ${data.meetingId} not found`);
        socket.emit("meeting:error", { error: "Meeting not found" }); 
        return; 
      }

      // Check if this user was previously in the meeting with a different socket (reconnection)
      // Cancel any pending disconnect grace timer and transfer their participation
      let reconnected = false;
      for (const [oldSid, p] of meeting.participants) {
        if (oldSid !== socket.id && p.odId === user.id) {
          // Cancel grace period timer for old socket
          const timerKey = `${data.meetingId}:${oldSid}`;
          const timer = _disconnectTimers.get(timerKey);
          if (timer) { clearTimeout(timer); _disconnectTimers.delete(timerKey); }
          // Transfer participation to new socket
          meeting.participants.delete(oldSid);
          p.socketId = socket.id;
          p.hasVideo = data.hasVideo;
          p.hasAudio = data.hasAudio;
          if (data.livekitIdentity) p.livekitIdentity = data.livekitIdentity;
          meeting.participants.set(socket.id, p);
          socket.join(`meeting:${data.meetingId}`);
          // Transfer analytics record to new socket ID
          const analytics = _meetingAnalytics.get(data.meetingId);
          if (analytics) {
            const recordId = analytics.participantRecords.get(oldSid);
            if (recordId) {
              analytics.participantRecords.delete(oldSid);
              analytics.participantRecords.set(socket.id, recordId);
            }
          }
          reconnected = true;
          console.log(`📹 ${user.name} reconnected to meeting "${meeting.title}" (${oldSid} → ${socket.id})`);
          break;
        }
      }

      const alreadyInMeeting = meeting.participants.has(socket.id);
      const isHost = meeting.hostId === user.id;
      const isArl = user.userType === "arl";
      const isGuest = user.userType === "guest";
      const hasVideoCapability = isArl || isGuest;

      if (alreadyInMeeting) {
        // Host was pre-added during meeting:create or reconnected above — just update media state
        const existing = meeting.participants.get(socket.id)!;
        existing.hasVideo = data.hasVideo;
        existing.hasAudio = data.hasAudio;
        if (data.livekitIdentity) existing.livekitIdentity = data.livekitIdentity;
        console.log(`📹 ${user.name} already in meeting, updated media state (lkIdentity=${data.livekitIdentity})`);
      } else {
        // New participant joining
        const participant: MeetingParticipant = {
          odId: user.id,
          socketId: socket.id,
          livekitIdentity: data.livekitIdentity,
          name: user.name,
          userType: user.userType as "location" | "arl" | "guest",
          role: isHost ? "host" : (isArl ? "cohost" : "participant"),
          hasVideo: data.hasVideo,
          hasAudio: data.hasAudio,
          isMuted: !hasVideoCapability, // restaurants start muted; ARLs and guests start unmuted
          handRaised: false,
          joinedAt: Date.now(),
        };
        meeting.participants.set(socket.id, participant);
        socket.join(`meeting:${data.meetingId}`);
        console.log(`📹 ${user.name} joined meeting "${meeting.title}" as ${participant.role} (socket=${socket.id}, lkIdentity=${data.livekitIdentity})`);
      }

      const myParticipant = meeting.participants.get(socket.id)!;

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
        yourRole: myParticipant.role,
      });

      // Only broadcast participant-joined if this is a NEW joiner (not the host re-joining)
      if (!alreadyInMeeting) {
        socket.to(`meeting:${data.meetingId}`).emit("meeting:participant-joined", {
          meetingId: data.meetingId,
          participant: {
            odId: myParticipant.odId, socketId: socket.id, name: myParticipant.name,
            userType: myParticipant.userType, role: myParticipant.role,
            hasVideo: myParticipant.hasVideo, hasAudio: myParticipant.hasAudio,
            isMuted: myParticipant.isMuted, handRaised: myParticipant.handRaised,
          },
        });

        // Note: guest-waiting notification + push already sent on socket connect
      }
      // Track analytics: participant join
      if (!alreadyInMeeting) {
        const analytics = _meetingAnalytics.get(data.meetingId);
        if (analytics) {
          const participantRecordId = crypto.randomUUID();
          analytics.participantRecords.set(socket.id, participantRecordId);
          const currentCount = meeting.participants.size;
          if (currentCount > analytics.peakParticipants) analytics.peakParticipants = currentCount;
          try {
            console.log(`📊 Analytics: Tracking ${user.userType} participant ${user.name} (${user.id}) joining meeting ${data.meetingId}`);
            db.insert(schema.meetingParticipants).values({
              id: participantRecordId,
              meetingId: data.meetingId,
              participantId: user.id,
              participantName: user.name,
              participantType: user.userType as any,
              role: myParticipant.role,
              hadVideo: data.hasVideo,
              hadAudio: data.hasAudio,
            }).run();
            // Update meeting analytics totals
            const arlCount = db.select().from(schema.meetingParticipants).where(and(eq(schema.meetingParticipants.meetingId, data.meetingId), eq(schema.meetingParticipants.participantType, 'arl'))).all().length;
            const locCount = db.select().from(schema.meetingParticipants).where(and(eq(schema.meetingParticipants.meetingId, data.meetingId), eq(schema.meetingParticipants.participantType, 'location'))).all().length;
            const guestCount = db.select().from(schema.meetingParticipants).where(and(eq(schema.meetingParticipants.meetingId, data.meetingId), eq(schema.meetingParticipants.participantType, 'guest'))).all().length;
            db.update(schema.meetingAnalytics)
              .set({
                totalParticipants: meeting.participants.size,
                peakParticipants: analytics.peakParticipants,
                totalArls: arlCount,
                totalLocations: locCount,
                totalGuests: guestCount,
              })
              .where(eq(schema.meetingAnalytics.id, analytics.analyticsId))
              .run();
          } catch (e) { console.error('Analytics insert error:', e); }
        }
      }
      console.log(`📹 ${user.name} ${alreadyInMeeting ? "re-joined" : "joined"} meeting "${meeting.title}" as ${myParticipant.role}`);
    });

    // ── Leave meeting ──
    socket.on("meeting:leave", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) {
        console.log(`📹 meeting:leave — meeting ${data.meetingId} not found (already ended?)`);
        return;
      }
      const leavingParticipant = meeting.participants.get(socket.id);
      if (!leavingParticipant) {
        console.log(`📹 meeting:leave — ${user.name} not in participants (already left?)`);
        return;
      }
      console.log(`📹 meeting:leave — ${user.name} leaving meeting "${meeting.title}" (role: ${leavingParticipant.role}, remaining before: ${meeting.participants.size})`);
      meeting.participants.delete(socket.id);
      socket.leave(`meeting:${data.meetingId}`);

      // Track analytics: participant leave
      const analytics = _meetingAnalytics.get(data.meetingId);
      if (analytics && leavingParticipant) {
        const recordId = analytics.participantRecords.get(socket.id);
        if (recordId) {
          const duration = Math.round((Date.now() - leavingParticipant.joinedAt) / 1000);
          try {
            db.update(schema.meetingParticipants)
              .set({ leftAt: new Date().toISOString(), duration })
              .where(eq(schema.meetingParticipants.id, recordId)).run();
          } catch (e) { console.error('Analytics leave error:', e); }
        }
      }

      io!.to(`meeting:${data.meetingId}`).emit("meeting:participant-left", {
        meetingId: data.meetingId, socketId: socket.id, name: user.name,
      });

      // If no participants remain, end the meeting immediately
      console.log(`📹 meeting:leave — remaining participants: ${meeting.participants.size}`);
      if (meeting.participants.size === 0) {
        console.log(`📹 meeting:leave — no participants left, ending meeting`);
        forceEndMeeting(data.meetingId, "No participants remaining");
        return;
      }

      // If the host left (not ended), start 10-minute auto-end countdown
      if (leavingParticipant?.role === "host") {
        const hasNewHost = Array.from(meeting.participants.values()).some(p => p.role === "host");
        console.log(`📹 Host left check: hasNewHost=${hasNewHost}, remaining participants: ${meeting.participants.size}`);
        if (!hasNewHost) {
          meeting.hostLeftAt = Date.now();
          console.log(`⏳ Host left meeting "${meeting.title}" — 10-minute auto-end countdown started, emitting countdown event`);

          // Notify remaining participants that host has left
          io!.to(`meeting:${data.meetingId}`).emit("meeting:host-left-countdown", {
            meetingId: data.meetingId,
            secondsRemaining: HOST_LEFT_AUTO_END_MS / 1000,
            hostName: leavingParticipant.name,
          });

          // Schedule warning broadcasts at key intervals
          for (const warnSec of HOST_LEFT_WARNING_INTERVALS) {
            const delay = (HOST_LEFT_AUTO_END_MS / 1000 - warnSec) * 1000;
            if (delay > 0) {
              setTimeout(() => {
                // Only send if meeting still exists and still has no host
                const m = _activeMeetings.get(data.meetingId);
                if (m && m.hostLeftAt && !Array.from(m.participants.values()).some(p => p.role === "host")) {
                  io!.to(`meeting:${data.meetingId}`).emit("meeting:host-left-countdown", {
                    meetingId: data.meetingId,
                    secondsRemaining: warnSec,
                  });
                }
              }, delay);
            }
          }

          // Cancel any existing timer, then set the 10-min auto-end
          const existingTimer = _hostLeftTimers.get(data.meetingId);
          if (existingTimer) clearTimeout(existingTimer);
          _hostLeftTimers.set(data.meetingId, setTimeout(() => {
            _hostLeftTimers.delete(data.meetingId);
            const m = _activeMeetings.get(data.meetingId);
            if (m && !Array.from(m.participants.values()).some(p => p.role === "host")) {
              forceEndMeeting(data.meetingId, "Host left — meeting auto-ended after 10 minutes");
            }
          }, HOST_LEFT_AUTO_END_MS));
          
          // Broadcast updated meeting list to ARLs (meeting still active but host left)
          const currentMeetings = Array.from(_activeMeetings.values()).map(m => ({
            meetingId: m.meetingId, title: m.title,
            hostName: m.hostName, hostId: m.hostId,
            participantCount: m.participants.size,
            createdAt: m.createdAt,
          }));
          io!.to("arls").emit("meeting:list", { meetings: currentMeetings });
        }
      }
    });

    // ── End meeting (host only) ──
    // Check if user is host by comparing hostId against user.id OR their livekitIdentity
    socket.on("meeting:end", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      // Get the participant's livekitIdentity for comparison
      const me = meeting.participants.get(socket.id);
      const myLkIdentity = me?.livekitIdentity;
      const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
      // Only host or any ARL can end the meeting
      if (!isHost && user.userType !== "arl") {
        console.log(`📹 meeting:end denied: ${user.name} is not host (hostId=${meeting.hostId}, userId=${user.id}, lkId=${myLkIdentity})`);
        return;
      }
      forceEndMeeting(data.meetingId, `Ended by host ${user.name}`);
    });

    // ── Transfer host to another participant ──
    // SIMPLIFIED: Use LiveKit identity to identify target, broadcast to all
    socket.on("meeting:transfer-host", (data: { meetingId: string; targetIdentity: string; targetName?: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) {
        console.log(`⚠️ transfer-host: Meeting ${data.meetingId} not found`);
        return;
      }
      // Check if user is host by comparing hostId against user.id OR their livekitIdentity
      const me = meeting.participants.get(socket.id);
      const myLkIdentity = me?.livekitIdentity;
      const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
      if (!isHost) {
        console.log(`⚠️ transfer-host: User ${user.name} (${user.id}, lkId=${myLkIdentity}) is not host (hostId=${meeting.hostId})`);
        return;
      }

      console.log(`📹 Transfer host request: target=${data.targetIdentity}, targetName=${data.targetName}`);

      // Update meeting metadata
      const previousHostName = meeting.hostName;
      meeting.hostId = data.targetIdentity; // LiveKit identity becomes new hostId
      meeting.hostName = data.targetName || data.targetIdentity;

      // Cancel any host-left countdown since there's a new host
      meeting.hostLeftAt = undefined;
      const hostTimer = _hostLeftTimers.get(data.meetingId);
      if (hostTimer) { clearTimeout(hostTimer); _hostLeftTimers.delete(data.meetingId); }

      // Broadcast to ALL participants - they check their own identity to see if they're the new host
      io!.to(`meeting:${data.meetingId}`).emit("meeting:host-transferred", {
        meetingId: data.meetingId,
        newHostIdentity: data.targetIdentity,
        newHostName: meeting.hostName,
        previousHostName: previousHostName,
      });
      console.log(`📹 Emitted host-transferred to all: newHostIdentity=${data.targetIdentity}, newHostName=${meeting.hostName}`);
      console.log(`📹 Host transferred: ${user.name} → ${meeting.hostName} in "${meeting.title}"`);
    });

    // ── Raise hand (restaurant requests to speak) ──
    socket.on("meeting:raise-hand", (data: { meetingId: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) return;
      const p = meeting.participants.get(socket.id);
      if (!p) return;
      p.handRaised = true;
      // Track analytics: hand raise
      const analytics = _meetingAnalytics.get(data.meetingId);
      if (analytics) {
        analytics.handRaiseCount++;
        const recordId = analytics.participantRecords.get(socket.id);
        if (recordId) {
          try {
            const rec = db.select().from(schema.meetingParticipants).where(eq(schema.meetingParticipants.id, recordId)).get();
            if (rec) db.update(schema.meetingParticipants).set({ handRaiseCount: (rec.handRaiseCount || 0) + 1 }).where(eq(schema.meetingParticipants.id, recordId)).run();
          } catch (e) { /* ignore */ }
        }
      }
      io!.to(`meeting:${data.meetingId}`).emit("meeting:hand-raised", {
        meetingId: data.meetingId, socketId: socket.id, odId: p.odId, name: user.name,
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
        meetingId: data.meetingId, socketId: socket.id, odId: p.odId,
      });
    });

    // ── Allow speak (host/cohost unmutes a participant) ──
    // SIMPLIFIED: Broadcast to all participants, let clients filter by their LiveKit identity
    socket.on("meeting:allow-speak", (data: { meetingId: string; targetIdentity: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) {
        console.log(`🎤 allow-speak: meeting ${data.meetingId} not found`);
        return;
      }
      // Check if user is host by comparing hostId against user.id OR their livekitIdentity
      const me = meeting.participants.get(socket.id);
      const myLkIdentity = me?.livekitIdentity;
      const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
      // Only host/ARL can unmute
      if (!isHost && user.userType !== "arl") {
        console.log(`🎤 allow-speak: ${user.name} is not host`);
        return;
      }
      
      console.log(`🎤 allow-speak: ${user.name} unmuting ${data.targetIdentity} in ${data.meetingId}`);
      
      // Broadcast to ALL participants - let clients check their own identity
      io!.to(`meeting:${data.meetingId}`).emit("meeting:speak-allowed", { 
        meetingId: data.meetingId,
        targetIdentity: data.targetIdentity,
      });
    });

    // ── Mute participant (host/cohost mutes someone) ──
    // SIMPLIFIED: Broadcast to all participants, let clients filter by their LiveKit identity
    socket.on("meeting:mute-participant", (data: { meetingId: string; targetIdentity: string }) => {
      if (!user) return;
      const meeting = _activeMeetings.get(data.meetingId);
      if (!meeting) {
        console.log(`🔇 mute-participant: meeting ${data.meetingId} not found`);
        return;
      }
      // Check if user is host by comparing hostId against user.id OR their livekitIdentity
      const me = meeting.participants.get(socket.id);
      const myLkIdentity = me?.livekitIdentity;
      const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
      // Only host/ARL can mute
      if (!isHost && user.userType !== "arl") {
        console.log(`🔇 mute-participant: ${user.name} is not host`);
        return;
      }
      
      console.log(`🔇 mute-participant: ${user.name} muting ${data.targetIdentity} in ${data.meetingId}`);
      
      // Broadcast to ALL participants in the meeting room - let clients check their own identity
      io!.to(`meeting:${data.meetingId}`).emit("meeting:you-were-muted", { 
        meetingId: data.meetingId,
        targetIdentity: data.targetIdentity,
      });
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

    // ── Screen share notification ──
    socket.on("meeting:screen-share", (data: { meetingId: string; sharing: boolean }) => {
      if (!user) return;
      socket.to(`meeting:${data.meetingId}`).emit("meeting:screen-share", {
        meetingId: data.meetingId,
        socketId: socket.id,
        name: user.name,
        sharing: data.sharing,
      });
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
      // Track analytics: chat message
      const analytics = _meetingAnalytics.get(data.meetingId);
      if (analytics) {
        analytics.messageCount++;
        const recordId = analytics.participantRecords.get(socket.id);
        if (recordId) {
          try {
            const rec = db.select().from(schema.meetingParticipants).where(eq(schema.meetingParticipants.id, recordId)).get();
            if (rec) db.update(schema.meetingParticipants).set({ messagesSent: (rec.messagesSent || 0) + 1 }).where(eq(schema.meetingParticipants.id, recordId)).run();
          } catch (e) { /* ignore */ }
        }
      }
      io!.to(`meeting:${data.meetingId}`).emit("meeting:chat-message", msg);
    });

    // ── Reaction in meeting ──
    socket.on("meeting:reaction", (data: { meetingId: string; emoji: string }) => {
      if (!user) return;
      // Track analytics: reaction
      const analytics = _meetingAnalytics.get(data.meetingId);
      if (analytics) {
        analytics.reactionCount++;
        const recordId = analytics.participantRecords.get(socket.id);
        if (recordId) {
          try {
            const rec = db.select().from(schema.meetingParticipants).where(eq(schema.meetingParticipants.id, recordId)).get();
            if (rec) db.update(schema.meetingParticipants).set({ reactionsSent: (rec.reactionsSent || 0) + 1 }).where(eq(schema.meetingParticipants.id, recordId)).run();
          } catch (e) { /* ignore */ }
        }
      }
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
      // Track analytics: question
      const analytics = _meetingAnalytics.get(data.meetingId);
      if (analytics) {
        analytics.questionCount++;
        const recordId = analytics.participantRecords.get(socket.id);
        if (recordId) {
          try {
            const rec = db.select().from(schema.meetingParticipants).where(eq(schema.meetingParticipants.id, recordId)).get();
            if (rec) db.update(schema.meetingParticipants).set({ questionsSent: (rec.questionsSent || 0) + 1 }).where(eq(schema.meetingParticipants.id, recordId)).run();
          } catch (e) { /* ignore */ }
        }
      }
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
        // Clean up meetings: use grace period before removing participant
        // This prevents hosts from being kicked during brief disconnects (e.g. screen share on mobile)
        const DISCONNECT_GRACE_MS = 20_000; // 20 seconds
        for (const [meetingId, meeting] of _activeMeetings.entries()) {
          if (meeting.participants.has(socket.id)) {
            const participant = meeting.participants.get(socket.id)!;
            const timerKey = `${meetingId}:${socket.id}`;

            // Cancel any existing timer for this participant
            const existing = _disconnectTimers.get(timerKey);
            if (existing) clearTimeout(existing);

            // Set grace period timer — if they reconnect before it fires, we cancel it
            const timer = setTimeout(() => {
              _disconnectTimers.delete(timerKey);
              // Only remove if still in the meeting (they may have reconnected with a new socket)
              if (meeting.participants.has(socket.id)) {
                meeting.participants.delete(socket.id);
                io!.to(`meeting:${meetingId}`).emit("meeting:participant-left", {
                  meetingId, socketId: socket.id, name: participant.name,
                });
                if (meeting.participants.size === 0) {
                  _activeMeetings.delete(meetingId);
                  // Finalize analytics
                  const analytics = _meetingAnalytics.get(meetingId);
                  if (analytics) {
                    const duration = Math.round((Date.now() - meeting.createdAt) / 1000);
                    try {
                      db.update(schema.meetingAnalytics).set({
                        endedAt: new Date().toISOString(),
                        duration,
                        totalMessages: analytics.messageCount,
                        totalQuestions: analytics.questionCount,
                        totalReactions: analytics.reactionCount,
                        totalHandRaises: analytics.handRaiseCount,
                        peakParticipants: analytics.peakParticipants,
                      }).where(eq(schema.meetingAnalytics.id, analytics.analyticsId)).run();
                    } catch (e) { console.error('Analytics finalize error:', e); }
                    _meetingAnalytics.delete(meetingId);
                  }
                  io!.to("locations").emit("meeting:ended", { meetingId });
                  io!.to("arls").emit("meeting:ended", { meetingId });
                  io!.to("all").emit("meeting:ended", { meetingId }); // Include guests
                  
                  // Broadcast updated meeting list
                  const remainingMeetings = Array.from(_activeMeetings.values()).map(m => ({
                    meetingId: m.meetingId, title: m.title,
                    hostName: m.hostName, hostId: m.hostId,
                    participantCount: m.participants.size,
                    createdAt: m.createdAt,
                  }));
                  io!.to("arls").emit("meeting:list", { meetings: remainingMeetings });
                  
                  console.log(`📹 Meeting "${meeting.title}" ended (empty after grace period)`);
                }
              }
            }, DISCONNECT_GRACE_MS);

            _disconnectTimers.set(timerKey, timer);
            console.log(`⏳ ${user.name} disconnected from meeting "${meeting.title}" — ${DISCONNECT_GRACE_MS / 1000}s grace period`);
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
