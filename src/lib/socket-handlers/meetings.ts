import type { Server as SocketIOServer, Socket } from "socket.io";
import type { AuthPayload } from "../auth";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { createNotificationBulk } from "../notifications";
import type { ActiveMeeting, MeetingParticipant } from "./types";
import {
  activeMeetings,
  meetingAnalytics,
  hostLeftTimers,
  disconnectTimers,
  HOST_LEFT_AUTO_END_MS,
  HOST_LEFT_WARNING_INTERVALS,
  DISCONNECT_GRACE_MS,
} from "./state";
import { getIO } from "../socket-server";

// ── Force-end a meeting (reusable by multiple triggers) ──
export function forceEndMeeting(meetingId: string, reason: string) {
  const io = getIO();
  if (!io) return;
  const meeting = activeMeetings.get(meetingId);
  if (!meeting) return;

  const hostTimer = hostLeftTimers.get(meetingId);
  if (hostTimer) { clearTimeout(hostTimer); hostLeftTimers.delete(meetingId); }

  const analytics = meetingAnalytics.get(meetingId);
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
    meetingAnalytics.delete(meetingId);
  }

  for (const [sid] of meeting.participants) {
    const timerKey = `${meetingId}:${sid}`;
    const timer = disconnectTimers.get(timerKey);
    if (timer) { clearTimeout(timer); disconnectTimers.delete(timerKey); }
  }

  io.to(`meeting:${meetingId}`).emit("meeting:ended", { meetingId, reason });
  io.to("locations").emit("meeting:ended", { meetingId });
  io.to("arls").emit("meeting:ended", { meetingId });
  io.to("all").emit("meeting:ended", { meetingId });
  activeMeetings.delete(meetingId);

  const remainingMeetings = Array.from(activeMeetings.values()).map(m => ({
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
    for (const [meetingId, meeting] of activeMeetings.entries()) {
      if (meeting.participants.size === 0) {
        forceEndMeeting(meetingId, "No participants remaining");
        continue;
      }
      if (Date.now() - meeting.createdAt > 4 * 60 * 60 * 1000) {
        forceEndMeeting(meetingId, "Meeting exceeded 4-hour maximum duration");
        continue;
      }
    }
  }, 60_000);
}

// Helper: serialize participants map for emission
function serializeParticipants(meeting: ActiveMeeting) {
  return Array.from(meeting.participants.values()).map(p => ({
    odId: p.odId, socketId: p.socketId, name: p.name,
    userType: p.userType, role: p.role, hasVideo: p.hasVideo,
    hasAudio: p.hasAudio, isMuted: p.isMuted, handRaised: p.handRaised,
  }));
}

function broadcastMeetingState(io: SocketIOServer, meeting: ActiveMeeting) {
  io.to(`meeting:${meeting.meetingId}`).emit("meeting:participants-updated", {
    meetingId: meeting.meetingId,
    participants: serializeParticipants(meeting),
  });
}

/**
 * Register all meeting-related socket event handlers.
 */
export function registerMeetingHandlers(io: SocketIOServer, socket: Socket, user: AuthPayload | null) {
  // ── Create meeting (ARL only) ──
  socket.on("meeting:create", (data: { meetingId: string; title: string; password?: string; meetingCode?: string }) => {
    if (!user || user.userType !== "arl") return;

    const existingMeeting = activeMeetings.get(data.meetingId);
    if (existingMeeting) {
      console.log(`📹 Meeting ${data.meetingId} already exists — ending previous instance`);
      forceEndMeeting(data.meetingId, "New meeting session started with same ID");
    }

    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const hostParticipant: MeetingParticipant = {
      odId: user.id, socketId: socket.id, name: user.name,
      userType: "arl", role: "host", hasVideo: true, hasAudio: true,
      isMuted: false, handRaised: false, joinedAt: Date.now(),
    };
    const meeting: ActiveMeeting = {
      meetingId: data.meetingId, instanceId, title: data.title,
      hostId: user.id, hostName: user.name, meetingCode: data.meetingCode,
      password: data.password, createdAt: Date.now(),
      participants: new Map([[socket.id, hostParticipant]]),
    };
    activeMeetings.set(data.meetingId, meeting);
    socket.join(`meeting:${data.meetingId}`);

    const analyticsId = crypto.randomUUID();
    try {
      db.insert(schema.meetingAnalytics).values({
        id: analyticsId, meetingId: data.meetingId, title: data.title,
        hostId: user.id, hostName: user.name,
        totalParticipants: 1, totalArls: 1, peakParticipants: 1,
      }).run();
      meetingAnalytics.set(data.meetingId, {
        meetingId: data.meetingId, analyticsId,
        participantRecords: new Map(), messageCount: 0,
        questionCount: 0, reactionCount: 0, handRaiseCount: 0, peakParticipants: 1,
      });
    } catch (e) { console.error('Analytics create error:', e); }

    const startedPayload = {
      meetingId: data.meetingId, title: data.title,
      hostName: user.name, hostId: user.id, hostSocketId: socket.id,
    };
    io.to("locations").emit("meeting:started", startedPayload);
    io.to("arls").emit("meeting:started", startedPayload);
    io.to("all").emit("meeting:started", startedPayload);
    io.to(`meeting:${data.meetingId}`).emit("meeting:started", startedPayload);
    console.log(`📹 Meeting created: "${data.title}" by ${user.name}`);
  });

  // ── Join meeting ──
  socket.on("meeting:join", (data: { meetingId: string; hasVideo: boolean; hasAudio: boolean; livekitIdentity?: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) { socket.emit("meeting:error", { error: "Meeting not found" }); return; }

    let reconnected = false;
    for (const [oldSid, p] of meeting.participants) {
      if (oldSid !== socket.id && p.odId === user.id) {
        const timerKey = `${data.meetingId}:${oldSid}`;
        const timer = disconnectTimers.get(timerKey);
        if (timer) { clearTimeout(timer); disconnectTimers.delete(timerKey); }
        meeting.participants.delete(oldSid);
        p.socketId = socket.id;
        p.hasVideo = data.hasVideo;
        p.hasAudio = data.hasAudio;
        if (data.livekitIdentity) p.livekitIdentity = data.livekitIdentity;
        meeting.participants.set(socket.id, p);
        socket.join(`meeting:${data.meetingId}`);
        const analytics = meetingAnalytics.get(data.meetingId);
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
      const existing = meeting.participants.get(socket.id)!;
      existing.hasVideo = data.hasVideo;
      existing.hasAudio = data.hasAudio;
      if (data.livekitIdentity) existing.livekitIdentity = data.livekitIdentity;
    } else {
      const participant: MeetingParticipant = {
        odId: user.id, socketId: socket.id, livekitIdentity: data.livekitIdentity,
        name: user.name, userType: user.userType as "location" | "arl" | "guest",
        role: isHost ? "host" : (isArl ? "cohost" : "participant"),
        hasVideo: data.hasVideo, hasAudio: data.hasAudio,
        isMuted: !hasVideoCapability, handRaised: false, joinedAt: Date.now(),
      };
      meeting.participants.set(socket.id, participant);
      socket.join(`meeting:${data.meetingId}`);
    }

    const myParticipant = meeting.participants.get(socket.id)!;
    const existingParticipants = Array.from(meeting.participants.entries())
      .filter(([sid]) => sid !== socket.id)
      .map(([sid, p]) => ({
        odId: p.odId, socketId: sid, name: p.name,
        userType: p.userType, role: p.role, hasVideo: p.hasVideo,
        hasAudio: p.hasAudio, isMuted: p.isMuted, handRaised: p.handRaised,
      }));
    socket.emit("meeting:joined", {
      meetingId: data.meetingId, title: meeting.title,
      hostName: meeting.hostName, participants: existingParticipants,
      yourRole: myParticipant.role,
    });

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

      if (myParticipant.role !== "host") {
        createNotificationBulk([meeting.hostId], {
          userType: "arl", type: "meeting_joined",
          title: `${myParticipant.name} joined your meeting`,
          message: `${meeting.title}`,
          actionUrl: "/arl?view=meetings", actionLabel: "View Meeting",
          priority: "normal",
          metadata: { meetingId: data.meetingId, participantName: myParticipant.name, participantType: myParticipant.userType },
        }).catch(err => console.error("Failed to create meeting_joined notification:", err));
      }
    }

    if (!alreadyInMeeting) {
      const analytics = meetingAnalytics.get(data.meetingId);
      if (analytics) {
        const participantRecordId = crypto.randomUUID();
        analytics.participantRecords.set(socket.id, participantRecordId);
        const currentCount = meeting.participants.size;
        if (currentCount > analytics.peakParticipants) analytics.peakParticipants = currentCount;
        try {
          db.insert(schema.meetingParticipants).values({
            id: participantRecordId, meetingId: data.meetingId,
            participantId: user.id, participantName: user.name,
            participantType: user.userType as any, role: myParticipant.role,
            hadVideo: data.hasVideo, hadAudio: data.hasAudio,
          }).run();
          const arlCount = db.select().from(schema.meetingParticipants).where(and(eq(schema.meetingParticipants.meetingId, data.meetingId), eq(schema.meetingParticipants.participantType, 'arl'))).all().length;
          const locCount = db.select().from(schema.meetingParticipants).where(and(eq(schema.meetingParticipants.meetingId, data.meetingId), eq(schema.meetingParticipants.participantType, 'location'))).all().length;
          const guestCount = db.select().from(schema.meetingParticipants).where(and(eq(schema.meetingParticipants.meetingId, data.meetingId), eq(schema.meetingParticipants.participantType, 'guest'))).all().length;
          db.update(schema.meetingAnalytics).set({
            totalParticipants: meeting.participants.size,
            peakParticipants: analytics.peakParticipants,
            totalArls: arlCount, totalLocations: locCount, totalGuests: guestCount,
          }).where(eq(schema.meetingAnalytics.id, analytics.analyticsId)).run();
        } catch (e) { console.error('Analytics insert error:', e); }
      }
    }
  });

  // ── Leave meeting ──
  socket.on("meeting:leave", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const leavingParticipant = meeting.participants.get(socket.id);
    if (!leavingParticipant) return;
    meeting.participants.delete(socket.id);
    socket.leave(`meeting:${data.meetingId}`);

    const analytics = meetingAnalytics.get(data.meetingId);
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

    io.to(`meeting:${data.meetingId}`).emit("meeting:participant-left", {
      meetingId: data.meetingId, socketId: socket.id, name: user.name,
    });

    if (meeting.participants.size === 0) {
      forceEndMeeting(data.meetingId, "No participants remaining");
      return;
    }

    if (leavingParticipant?.role === "host") {
      const hasNewHost = Array.from(meeting.participants.values()).some(p => p.role === "host");
      if (!hasNewHost) {
        meeting.hostLeftAt = Date.now();
        io.to(`meeting:${data.meetingId}`).emit("meeting:host-left-countdown", {
          meetingId: data.meetingId,
          secondsRemaining: HOST_LEFT_AUTO_END_MS / 1000,
          hostName: leavingParticipant.name,
        });
        for (const warnSec of HOST_LEFT_WARNING_INTERVALS) {
          const delay = (HOST_LEFT_AUTO_END_MS / 1000 - warnSec) * 1000;
          if (delay > 0) {
            setTimeout(() => {
              const m = activeMeetings.get(data.meetingId);
              if (m && m.hostLeftAt && !Array.from(m.participants.values()).some(p => p.role === "host")) {
                io.to(`meeting:${data.meetingId}`).emit("meeting:host-left-countdown", {
                  meetingId: data.meetingId, secondsRemaining: warnSec,
                });
              }
            }, delay);
          }
        }
        const existingTimer = hostLeftTimers.get(data.meetingId);
        if (existingTimer) clearTimeout(existingTimer);
        hostLeftTimers.set(data.meetingId, setTimeout(() => {
          hostLeftTimers.delete(data.meetingId);
          const m = activeMeetings.get(data.meetingId);
          if (m && !Array.from(m.participants.values()).some(p => p.role === "host")) {
            forceEndMeeting(data.meetingId, "Host left — meeting auto-ended after 10 minutes");
          }
        }, HOST_LEFT_AUTO_END_MS));

        const currentMeetings = Array.from(activeMeetings.values()).map(m => ({
          meetingId: m.meetingId, title: m.title,
          hostName: m.hostName, hostId: m.hostId,
          participantCount: m.participants.size, createdAt: m.createdAt,
        }));
        io.to("arls").emit("meeting:list", { meetings: currentMeetings });
      }
    }
  });

  // ── End meeting (host only) ──
  socket.on("meeting:end", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const myLkIdentity = me?.livekitIdentity;
    const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
    if (!isHost) return;
    forceEndMeeting(data.meetingId, `Ended by host ${user.name}`);
  });

  // ── Transfer host ──
  socket.on("meeting:transfer-host", (data: { meetingId: string; targetIdentity: string; targetName?: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const myLkIdentity = me?.livekitIdentity;
    const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
    if (!isHost) return;

    const previousHostName = meeting.hostName;
    meeting.hostId = data.targetIdentity;
    meeting.hostName = data.targetName || data.targetIdentity;
    if (me) me.role = me.userType === "arl" ? "cohost" : "participant";
    for (const [, p] of meeting.participants) {
      if (p.livekitIdentity === data.targetIdentity || p.odId === data.targetIdentity) {
        p.role = "host"; break;
      }
    }
    meeting.hostLeftAt = undefined;
    const hostTimer = hostLeftTimers.get(data.meetingId);
    if (hostTimer) { clearTimeout(hostTimer); hostLeftTimers.delete(data.meetingId); }
    io.to(`meeting:${data.meetingId}`).emit("meeting:host-transferred", {
      meetingId: data.meetingId, newHostIdentity: data.targetIdentity,
      newHostName: meeting.hostName, previousHostName,
    });
    console.log(`📹 Host transferred: ${user.name} → ${meeting.hostName} in "${meeting.title}"`);
  });

  // ── Raise/lower hand ──
  socket.on("meeting:raise-hand", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const p = meeting.participants.get(socket.id);
    if (!p) return;
    p.handRaised = true;
    const analytics = meetingAnalytics.get(data.meetingId);
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
    io.to(`meeting:${data.meetingId}`).emit("meeting:hand-raised", {
      meetingId: data.meetingId, socketId: socket.id, odId: p.odId, livekitIdentity: p.livekitIdentity, name: user.name,
    });
  });

  socket.on("meeting:lower-hand", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const p = meeting.participants.get(socket.id);
    if (!p) return;
    p.handRaised = false;
    io.to(`meeting:${data.meetingId}`).emit("meeting:hand-lowered", {
      meetingId: data.meetingId, socketId: socket.id, odId: p.odId, livekitIdentity: p.livekitIdentity,
    });
  });

  // ── Allow speak / mute participant ──
  socket.on("meeting:allow-speak", (data: { meetingId: string; targetIdentity: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const myLkIdentity = me?.livekitIdentity;
    const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
    if (!isHost && user.userType !== "arl") return;
    io.to(`meeting:${data.meetingId}`).emit("meeting:speak-allowed", {
      meetingId: data.meetingId, targetIdentity: data.targetIdentity,
    });
  });

  socket.on("meeting:mute-participant", (data: { meetingId: string; targetIdentity: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const myLkIdentity = me?.livekitIdentity;
    const isHost = meeting.hostId === user.id || meeting.hostId === myLkIdentity;
    if (!isHost && user.userType !== "arl") return;
    io.to(`meeting:${data.meetingId}`).emit("meeting:you-were-muted", {
      meetingId: data.meetingId, targetIdentity: data.targetIdentity,
    });
  });

  // ── Media update ──
  socket.on("meeting:media-update", (data: { meetingId: string; hasVideo?: boolean; hasAudio?: boolean }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const p = meeting.participants.get(socket.id);
    if (!p) return;
    if (data.hasVideo !== undefined) p.hasVideo = data.hasVideo;
    if (data.hasAudio !== undefined) p.hasAudio = data.hasAudio;
    broadcastMeetingState(io, meeting);
  });

  // ── Screen share ──
  socket.on("meeting:screen-share", (data: { meetingId: string; sharing: boolean }) => {
    if (!user) return;
    socket.to(`meeting:${data.meetingId}`).emit("meeting:screen-share", {
      meetingId: data.meetingId, socketId: socket.id, name: user.name, sharing: data.sharing,
    });
  });

  // ── Mute/unmute all, lower all hands ──
  socket.on("meeting:mute-all", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const isHost = meeting.hostId === user.id || meeting.hostId === me?.livekitIdentity;
    if (!isHost) return;
    io.to(`meeting:${data.meetingId}`).emit("meeting:mute-all", { meetingId: data.meetingId });
  });

  socket.on("meeting:unmute-all", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const isHost = meeting.hostId === user.id || meeting.hostId === me?.livekitIdentity;
    if (!isHost) return;
    io.to(`meeting:${data.meetingId}`).emit("meeting:unmute-all", { meetingId: data.meetingId });
  });

  socket.on("meeting:lower-all-hands", (data: { meetingId: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const isHost = meeting.hostId === user.id || meeting.hostId === me?.livekitIdentity;
    if (!isHost) return;
    for (const p of meeting.participants.values()) p.handRaised = false;
    io.to(`meeting:${data.meetingId}`).emit("meeting:lower-all-hands", { meetingId: data.meetingId });
  });

  socket.on("meeting:lower-hand-target", (data: { meetingId: string; targetIdentity: string }) => {
    if (!user) return;
    const meeting = activeMeetings.get(data.meetingId);
    if (!meeting) return;
    const me = meeting.participants.get(socket.id);
    const isHost = meeting.hostId === user.id || meeting.hostId === me?.livekitIdentity;
    if (!isHost && user.userType !== "arl") return;
    for (const p of meeting.participants.values()) {
      if (p.livekitIdentity === data.targetIdentity) { p.handRaised = false; break; }
    }
    io.to(`meeting:${data.meetingId}`).emit("meeting:hand-lowered", {
      meetingId: data.meetingId, livekitIdentity: data.targetIdentity,
    });
  });

  // ── Set nickname ──
  socket.on("meeting:set-nickname", (data: { meetingId: string; targetIdentity: string; nickname: string }) => {
    if (!user) return;
    io.to(`meeting:${data.meetingId}`).emit("meeting:nickname-updated", {
      meetingId: data.meetingId, livekitIdentity: data.targetIdentity, nickname: data.nickname,
    });
  });

  // ── Chat, reactions, Q&A ──
  socket.on("meeting:chat", (data: { meetingId: string; content: string }) => {
    if (!user) return;
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderName: user.name, senderType: user.userType,
      content: data.content, timestamp: Date.now(),
    };
    const analytics = meetingAnalytics.get(data.meetingId);
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
    io.to(`meeting:${data.meetingId}`).emit("meeting:chat-message", msg);
  });

  socket.on("meeting:reaction", (data: { meetingId: string; emoji: string }) => {
    if (!user) return;
    const analytics = meetingAnalytics.get(data.meetingId);
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
    io.to(`meeting:${data.meetingId}`).emit("meeting:reaction", { emoji: data.emoji, senderName: user.name });
  });

  socket.on("meeting:question", (data: { meetingId: string; question: string }) => {
    if (!user) return;
    const q = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      askerName: user.name, question: data.question, upvotes: 0, isAnswered: false,
    };
    const analytics = meetingAnalytics.get(data.meetingId);
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
    io.to(`meeting:${data.meetingId}`).emit("meeting:question", q);
  });

  socket.on("meeting:answer-question", (data: { meetingId: string; questionId: string }) => {
    io.to(`meeting:${data.meetingId}`).emit("meeting:question-answered", { questionId: data.questionId });
  });

  socket.on("meeting:upvote-question", (data: { meetingId: string; questionId: string }) => {
    io.to(`meeting:${data.meetingId}`).emit("meeting:question-upvoted", { questionId: data.questionId });
  });

  // ── Meeting list ──
  socket.on("meeting:list", () => {
    const meetings = Array.from(activeMeetings.values()).map(m => ({
      meetingId: m.meetingId, title: m.title,
      hostName: m.hostName, hostId: m.hostId,
      participantCount: m.participants.size, createdAt: m.createdAt,
    }));
    socket.emit("meeting:list", { meetings });
  });

  // ── WebRTC Signaling ──
  socket.on("webrtc:offer", (data: { targetSocketId: string; offer: any }) => {
    io.to(data.targetSocketId).emit("webrtc:offer", { offer: data.offer, senderSocketId: socket.id });
  });
  socket.on("webrtc:answer", (data: { targetSocketId: string; answer: any }) => {
    io.to(data.targetSocketId).emit("webrtc:answer", { answer: data.answer, senderSocketId: socket.id });
  });
  socket.on("webrtc:ice-candidate", (data: { targetSocketId: string; candidate: any }) => {
    io.to(data.targetSocketId).emit("webrtc:ice-candidate", { candidate: data.candidate, senderSocketId: socket.id });
  });
}

/**
 * Handle meeting cleanup on socket disconnect.
 */
export function handleMeetingDisconnect(io: SocketIOServer, socket: Socket, user: AuthPayload) {
  for (const [meetingId, meeting] of activeMeetings.entries()) {
    if (meeting.participants.has(socket.id)) {
      const participant = meeting.participants.get(socket.id)!;
      const timerKey = `${meetingId}:${socket.id}`;

      const existing = disconnectTimers.get(timerKey);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        disconnectTimers.delete(timerKey);
        if (meeting.participants.has(socket.id)) {
          meeting.participants.delete(socket.id);
          io.to(`meeting:${meetingId}`).emit("meeting:participant-left", {
            meetingId, socketId: socket.id, name: participant.name,
          });
          if (meeting.participants.size === 0) {
            activeMeetings.delete(meetingId);
            const analytics = meetingAnalytics.get(meetingId);
            if (analytics) {
              const duration = Math.round((Date.now() - meeting.createdAt) / 1000);
              try {
                db.update(schema.meetingAnalytics).set({
                  endedAt: new Date().toISOString(), duration,
                  totalMessages: analytics.messageCount, totalQuestions: analytics.questionCount,
                  totalReactions: analytics.reactionCount, totalHandRaises: analytics.handRaiseCount,
                  peakParticipants: analytics.peakParticipants,
                }).where(eq(schema.meetingAnalytics.id, analytics.analyticsId)).run();
              } catch (e) { console.error('Analytics finalize error:', e); }
              meetingAnalytics.delete(meetingId);
            }
            io.to("locations").emit("meeting:ended", { meetingId });
            io.to("arls").emit("meeting:ended", { meetingId });
            io.to("all").emit("meeting:ended", { meetingId });
            const remainingMeetings = Array.from(activeMeetings.values()).map(m => ({
              meetingId: m.meetingId, title: m.title,
              hostName: m.hostName, hostId: m.hostId,
              participantCount: m.participants.size, createdAt: m.createdAt,
            }));
            io.to("arls").emit("meeting:list", { meetings: remainingMeetings });
            console.log(`📹 Meeting "${meeting.title}" ended (empty after grace period)`);
          }
        }
      }, DISCONNECT_GRACE_MS);

      disconnectTimers.set(timerKey, timer);
      console.log(`⏳ ${user.name} disconnected from meeting "${meeting.title}" — ${DISCONNECT_GRACE_MS / 1000}s grace period`);
    }
  }
}

// ── Public: find an active meeting by code (for guest join API) ──
export function findActiveMeetingByCode(code: string): { meetingId: string; title: string; hostName: string; hostId: string; password?: string } | null {
  const upperCode = code.toUpperCase().trim();
  for (const [, meeting] of activeMeetings) {
    if (meeting.meetingCode?.toUpperCase() === upperCode) {
      return { meetingId: meeting.meetingId, title: meeting.title, hostName: meeting.hostName, hostId: meeting.hostId, password: meeting.password };
    }
    if (meeting.meetingId === `scheduled-${upperCode}`) {
      return { meetingId: meeting.meetingId, title: meeting.title, hostName: meeting.hostName, hostId: meeting.hostId, password: meeting.password };
    }
  }
  return null;
}
