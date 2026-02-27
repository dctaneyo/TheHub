import type { Server as SocketIOServer, Socket } from "socket.io";
import type { AuthPayload } from "../auth";

// ── Meeting system types ──

export interface MeetingParticipant {
  odId: string;
  socketId: string;
  livekitIdentity?: string;
  name: string;
  userType: "location" | "arl" | "guest";
  role: "host" | "cohost" | "participant";
  hasVideo: boolean;
  hasAudio: boolean;
  isMuted: boolean;
  handRaised: boolean;
  joinedAt: number;
}

export interface ActiveMeeting {
  meetingId: string;
  instanceId: string;
  title: string;
  hostId: string;
  hostName: string;
  meetingCode?: string;
  password?: string;
  createdAt: number;
  participants: Map<string, MeetingParticipant>;
  hostLeftAt?: number;
  hostLeftTimer?: ReturnType<typeof setTimeout>;
}

export interface MeetingAnalyticsData {
  meetingId: string;
  analyticsId: string;
  participantRecords: Map<string, string>;
  messageCount: number;
  questionCount: number;
  reactionCount: number;
  handRaiseCount: number;
  peakParticipants: number;
}

// ── Force action types ──

export interface ForceAction {
  action: "logout" | "redirect";
  token?: string;
  redirectTo?: string;
}

// ── Handler registration signature ──
// Each module exports a function with this shape to register socket event handlers

export type SocketHandlerRegistrar = (
  io: SocketIOServer,
  socket: Socket,
  user: AuthPayload | null
) => void;
