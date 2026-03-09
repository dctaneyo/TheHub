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

// ── Remote view types ──

export interface CapturedElement {
  id: string;
  tag: string;
  selector: string;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  interactive: boolean;
  type?: string; // input type
  value?: string; // input value
  checked?: boolean;
  placeholder?: string;
  classes: string;
  href?: string;
  disabled?: boolean;
  styles?: {
    bgColor: string;
    color: string;
    fontSize: string;
    fontWeight: string;
    borderRadius: string;
    border: string;
    opacity: string;
    overflow: string;
    display: string;
    textAlign: string;
    boxShadow: string;
  };
  children?: number; // count of child elements
  zIndex?: number;
}

export interface DOMSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scroll: { x: number; y: number };
  elements: CapturedElement[];
  activeElementSelector: string | null;
  timestamp: number;
}

export interface RemoteViewSession {
  sessionId: string;
  locationId: string;
  locationName: string;
  arlId: string;
  arlName: string;
  arlSocketId: string;
  locationSocketId: string;
  status: "pending" | "active" | "ended";
  controlEnabled: boolean;
  startedAt: number;
}

export interface RemoteAction {
  type: "click" | "input" | "scroll" | "navigate" | "keyboard";
  selector?: string;
  value?: string;
  coords?: { x: number; y: number };
  key?: string;
  scrollDelta?: { x: number; y: number };
}

export interface UserEvent {
  type: "touch" | "click" | "scroll" | "input" | "navigate";
  selector?: string;
  coords?: { x: number; y: number };
  value?: string;
  timestamp: number;
}

// ── Handler registration signature ──
// Each module exports a function with this shape to register socket event handlers

export type SocketHandlerRegistrar = (
  io: SocketIOServer,
  socket: Socket,
  user: AuthPayload | null
) => void;
