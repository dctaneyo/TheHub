"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  PhoneOff, MessageCircle, HelpCircle, Hand, Users,
  Send, CheckCircle, ThumbsUp, X, Maximize2, Minimize2,
  Crown, Shield, Volume2, VolumeX, SwitchCamera, Keyboard, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
  iceTransportPolicy: "all",
};

// ── Types ──
interface Participant {
  odId: string;
  socketId: string;
  name: string;
  userType: "location" | "arl" | "guest";
  role: "host" | "cohost" | "participant";
  hasVideo: boolean;
  hasAudio: boolean;
  isMuted: boolean;
  handRaised: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderType: string;
  content: string;
  timestamp: number;
}

interface Question {
  id: string;
  askerName: string;
  question: string;
  upvotes: number;
  isAnswered: boolean;
}

interface MeetingRoomProps {
  meetingId: string;
  title: string;
  isHost: boolean;
  onLeave: () => void;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏", "💯"];

export function MeetingRoom({ meetingId, title, isHost, onLeave }: MeetingRoomProps) {
  const { user } = useAuth();
  const { socket } = useSocket();

  // ── State ──
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string>(isHost ? "host" : "participant");
  const hasVideoCapability = user?.userType === "arl" || user?.userType === "guest";
  const [videoEnabled, setVideoEnabled] = useState(isHost && hasVideoCapability);
  const [audioEnabled, setAudioEnabled] = useState(isHost);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenSharingParticipant, setScreenSharingParticipant] = useState<string | null>(null);
  const [isMutedByHost, setIsMutedByHost] = useState(user?.userType === "location");
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [showMeetingKeyboard, setShowMeetingKeyboard] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [joined, setJoined] = useState(false);

  // ── Refs ──
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  // ── Get local media ──
  const getLocalMedia = useCallback(async () => {
    try {
      const wantsVideo = user?.userType === "arl" || user?.userType === "guest";
      const constraints: MediaStreamConstraints = {
        // Request video if user has capability (we'll disable the track if not host)
        video: wantsVideo ? { width: 1280, height: 720 } : false,
        audio: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Only host starts with audio enabled; everyone else starts muted
      if (!isHost) {
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
      }

      // Only host starts with video enabled; others start with camera off
      if (!isHost && wantsVideo) {
        stream.getVideoTracks().forEach(t => { t.enabled = false; });
      }

      if (localVideoRef.current && wantsVideo && isHost) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      return stream;
    } catch (err) {
      console.error("Failed to get local media:", err);
      return null;
    }
  }, [user?.userType, isHost]);

  // ── Create peer connection to a specific participant ──
  const createPeerConnection = useCallback((targetSocketId: string, targetName: string, shouldCreateOffer: boolean) => {
    if (!socket || !localStreamRef.current) return;
    if (peerConnectionsRef.current.has(targetSocketId)) return;

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Add local tracks
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
      let remoteStream = remoteStreamsRef.current.get(targetSocketId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreamsRef.current.set(targetSocketId, remoteStream);
      }
      remoteStream.addTrack(event.track);

      // Attach to video element
      const videoEl = remoteVideoRefs.current.get(targetSocketId);
      if (videoEl && videoEl.srcObject !== remoteStream) {
        videoEl.srcObject = remoteStream;
        videoEl.play().catch(() => {});
      }
      // Force re-render to show the stream
      setParticipants(prev => [...prev]);
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("webrtc:ice-candidate", {
          targetSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`PC to ${targetName}: ${pc.connectionState}`);
      if (pc.connectionState === "failed") {
        // ICE restart for sporadic video issues
        pc.restartIce();
        pc.createOffer({ iceRestart: true }).then(offer => {
          return pc.setLocalDescription(offer);
        }).then(() => {
          socket.emit("webrtc:offer", {
            targetSocketId,
            offer: pc.localDescription!.toJSON(),
          });
        }).catch(err => console.error("ICE restart error:", err));
      }
    };

    // If we should create the offer (we're the "polite" peer when our socketId < target)
    if (shouldCreateOffer) {
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        socket.emit("webrtc:offer", {
          targetSocketId,
          offer: pc.localDescription!.toJSON(),
        });
      }).catch(err => console.error("Offer error:", err));
    }

    return pc;
  }, [socket]);

  // ── Join meeting ──
  const joinedOnceRef = useRef(false);
  useEffect(() => {
    if (!socket) return;

    const init = async () => {
      if (joinedOnceRef.current) return; // prevent double-join in Strict Mode
      joinedOnceRef.current = true;

      await getLocalMedia();

      const wantsVideo = user?.userType === "arl" || user?.userType === "guest";
      socket.emit("meeting:join", {
        meetingId,
        hasVideo: isHost && wantsVideo,
        hasAudio: isHost,
      });
    };

    if (!joined) init();

    return () => {
      // Defer cleanup so React Strict Mode re-mount can cancel it
      const socketRef = socket;
      const localStream = localStreamRef.current;
      const peerConns = peerConnectionsRef.current;
      const mid = meetingId;
      const didJoin = joinedOnceRef.current;

      setTimeout(() => {
        // If joinedOnceRef was reset by a new mount, skip cleanup
        if (joinedOnceRef.current) return;
        if (!didJoin) return;
        socketRef.emit("meeting:leave", { meetingId: mid });
        localStream?.getTracks().forEach(t => t.stop());
        peerConns.forEach(pc => pc.close());
        peerConns.clear();
        remoteStreamsRef.current.clear();
      }, 100);

      // Mark as not joined so re-mount can re-join
      joinedOnceRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, meetingId]);

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;

    const handleJoined = (data: { meetingId: string; title: string; participants: Participant[]; yourRole: string }) => {
      if (data.meetingId !== meetingId) return;
      setJoined(true);
      setWaitingForHost(false);
      setMyRole(data.yourRole);
      if (socket.id) setMySocketId(socket.id);
      setParticipants(data.participants);

      // Create peer connections to all existing participants
      // The joiner always creates offers to existing participants
      setTimeout(() => {
        data.participants.forEach(p => {
          createPeerConnection(p.socketId, p.name, true);
        });
      }, 500);
    };

    // If meeting doesn't exist yet (guest joined before host), wait for it
    const handleMeetingError = (data: { error: string }) => {
      if (data.error === "Meeting not found") {
        setWaitingForHost(true);
      }
    };

    // When host starts the meeting, auto-retry joining
    const handleMeetingStarted = (data: { meetingId: string }) => {
      if (data.meetingId !== meetingId) return;
      // Meeting now exists — retry join (non-host starts with video/audio off)
      socket.emit("meeting:join", {
        meetingId,
        hasVideo: false,
        hasAudio: false,
      });
    };

    const handleParticipantJoined = (data: { meetingId: string; participant: Participant }) => {
      if (data.meetingId !== meetingId) return;
      setParticipants(prev => {
        if (prev.find(p => p.socketId === data.participant.socketId)) return prev;
        return [...prev, data.participant];
      });
      // The existing participant waits for the joiner to send an offer
      // (don't create offer here — the joiner does it)
    };

    const handleParticipantLeft = (data: { meetingId: string; socketId: string }) => {
      if (data.meetingId !== meetingId) return;
      setParticipants(prev => prev.filter(p => p.socketId !== data.socketId));
      const pc = peerConnectionsRef.current.get(data.socketId);
      if (pc) { pc.close(); peerConnectionsRef.current.delete(data.socketId); }
      remoteStreamsRef.current.delete(data.socketId);
      remoteVideoRefs.current.delete(data.socketId);
    };

    const handleParticipantsUpdated = (data: { meetingId: string; participants: Participant[] }) => {
      if (data.meetingId !== meetingId) return;
      // Filter out self — we render local video separately
      const sid = socket.id;
      setParticipants(sid ? data.participants.filter(p => p.socketId !== sid) : data.participants);
    };

    const handleMeetingEnded = (data: { meetingId: string }) => {
      if (data.meetingId !== meetingId) return;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnectionsRef.current.forEach(pc => pc.close());
      onLeaveRef.current();
    };

    const handleSpeakAllowed = () => {
      setIsMutedByHost(false);
      setHandRaised(false);
      // Enable audio track
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
      setAudioEnabled(true);
    };

    const handleYouWereMuted = () => {
      setIsMutedByHost(true);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      setAudioEnabled(false);
    };

    const handleHandRaised = (data: { socketId: string }) => {
      setParticipants(prev => prev.map(p => p.socketId === data.socketId ? { ...p, handRaised: true } : p));
    };

    const handleHandLowered = (data: { socketId: string }) => {
      setParticipants(prev => prev.map(p => p.socketId === data.socketId ? { ...p, handRaised: false } : p));
    };

    const handleChatMessage = (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
    };

    const handleReaction = (data: { emoji: string; senderName: string }) => {
      const id = `${Date.now()}-${Math.random()}`;
      const x = Math.random() * 80 + 10;
      setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, x }]);
      setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
    };

    const handleQuestion = (data: Question) => {
      setQuestions(prev => [...prev, data]);
    };

    const handleQuestionAnswered = (data: { questionId: string }) => {
      setQuestions(prev => prev.map(q => q.id === data.questionId ? { ...q, isAnswered: true } : q));
    };

    const handleQuestionUpvoted = (data: { questionId: string }) => {
      setQuestions(prev => prev.map(q => q.id === data.questionId ? { ...q, upvotes: q.upvotes + 1 } : q));
    };

    // ── WebRTC signaling ──
    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; senderSocketId: string }) => {
      let pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (!pc) {
        const p = participants.find(p => p.socketId === data.senderSocketId);
        pc = createPeerConnection(data.senderSocketId, p?.name || "Unknown", false)!;
        if (!pc) return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Process pending ICE candidates
        const pending = pendingCandidatesRef.current.get(data.senderSocketId) || [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCandidatesRef.current.delete(data.senderSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", {
          targetSocketId: data.senderSocketId,
          answer: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    };

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; senderSocketId: string }) => {
      const pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        // Process pending ICE candidates
        const pending = pendingCandidatesRef.current.get(data.senderSocketId) || [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCandidatesRef.current.delete(data.senderSocketId);
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit; senderSocketId: string }) => {
      const pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      } else {
        // Queue until remote description is set
        const pending = pendingCandidatesRef.current.get(data.senderSocketId) || [];
        pending.push(data.candidate);
        pendingCandidatesRef.current.set(data.senderSocketId, pending);
      }
    };

    const handleScreenShare = (data: { meetingId: string; socketId: string; sharing: boolean }) => {
      if (data.meetingId !== meetingId) return;
      setScreenSharingParticipant(data.sharing ? data.socketId : null);
    };

    socket.on("meeting:joined", handleJoined);
    socket.on("meeting:error", handleMeetingError);
    socket.on("meeting:started", handleMeetingStarted);
    socket.on("meeting:participant-joined", handleParticipantJoined);
    socket.on("meeting:participant-left", handleParticipantLeft);
    socket.on("meeting:participants-updated", handleParticipantsUpdated);
    socket.on("meeting:ended", handleMeetingEnded);
    socket.on("meeting:speak-allowed", handleSpeakAllowed);
    socket.on("meeting:you-were-muted", handleYouWereMuted);
    socket.on("meeting:hand-raised", handleHandRaised);
    socket.on("meeting:hand-lowered", handleHandLowered);
    socket.on("meeting:chat-message", handleChatMessage);
    socket.on("meeting:reaction", handleReaction);
    socket.on("meeting:question", handleQuestion);
    socket.on("meeting:question-answered", handleQuestionAnswered);
    socket.on("meeting:question-upvoted", handleQuestionUpvoted);
    socket.on("meeting:screen-share", handleScreenShare);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("meeting:joined", handleJoined);
      socket.off("meeting:error", handleMeetingError);
      socket.off("meeting:started", handleMeetingStarted);
      socket.off("meeting:participant-joined", handleParticipantJoined);
      socket.off("meeting:participant-left", handleParticipantLeft);
      socket.off("meeting:participants-updated", handleParticipantsUpdated);
      socket.off("meeting:ended", handleMeetingEnded);
      socket.off("meeting:speak-allowed", handleSpeakAllowed);
      socket.off("meeting:you-were-muted", handleYouWereMuted);
      socket.off("meeting:hand-raised", handleHandRaised);
      socket.off("meeting:hand-lowered", handleHandLowered);
      socket.off("meeting:chat-message", handleChatMessage);
      socket.off("meeting:reaction", handleReaction);
      socket.off("meeting:question", handleQuestion);
      socket.off("meeting:question-answered", handleQuestionAnswered);
      socket.off("meeting:question-upvoted", handleQuestionUpvoted);
      socket.off("meeting:screen-share", handleScreenShare);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, meetingId, joined]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Controls ──
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    if (tracks.length > 0) {
      tracks.forEach(t => { t.enabled = !t.enabled; });
      const nowEnabled = tracks[0].enabled;
      setVideoEnabled(nowEnabled);
      socket?.emit("meeting:media-update", { meetingId, hasVideo: nowEnabled });
      // Attach stream to local video element when enabling for the first time
      if (nowEnabled && localVideoRef.current && !localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  };

  const toggleAudio = () => {
    if (isMutedByHost) return; // Can't unmute if muted by host
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    tracks.forEach(t => { t.enabled = !t.enabled; });
    const enabled = tracks[0]?.enabled ?? false;
    setAudioEnabled(enabled);
    socket?.emit("meeting:media-update", { meetingId, hasAudio: enabled });
  };

  const toggleScreenShare = async () => {
    if (!localStreamRef.current || !socket) return;
    try {
      if (!screenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => switchBackToCamera();

        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) { localStreamRef.current.removeTrack(oldTrack); oldTrack.stop(); }
        localStreamRef.current.addTrack(screenTrack);

        for (const [, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        setScreenSharing(true);
        setVideoEnabled(true);
        socket.emit("meeting:screen-share", { meetingId, sharing: true });
      } else {
        await switchBackToCamera();
      }
    } catch (err: any) {
      if (err.name !== "NotAllowedError") console.error("Screen share error:", err);
    }
  };

  const switchBackToCamera = async () => {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      const camTrack = cam.getVideoTracks()[0];
      const old = localStreamRef.current?.getVideoTracks()[0];
      if (old && localStreamRef.current) { localStreamRef.current.removeTrack(old); old.stop(); }
      localStreamRef.current?.addTrack(camTrack);
      for (const [, pc] of peerConnectionsRef.current.entries()) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(camTrack);
      }
      if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setScreenSharing(false);
      socket?.emit("meeting:screen-share", { meetingId, sharing: false });
    } catch (err) { console.error("Camera switch error:", err); }
  };

  const toggleRaiseHand = () => {
    if (!socket) return;
    if (handRaised) {
      socket.emit("meeting:lower-hand", { meetingId });
      setHandRaised(false);
    } else {
      socket.emit("meeting:raise-hand", { meetingId });
      setHandRaised(true);
    }
  };

  const allowSpeak = (targetSocketId: string) => {
    socket?.emit("meeting:allow-speak", { meetingId, targetSocketId });
  };

  const muteParticipant = (targetSocketId: string) => {
    socket?.emit("meeting:mute-participant", { meetingId, targetSocketId });
  };

  const sendChat = () => {
    if (!newMessage.trim() || !socket) return;
    socket.emit("meeting:chat", { meetingId, content: newMessage.trim() });
    setNewMessage("");
  };

  const sendReaction = (emoji: string) => {
    socket?.emit("meeting:reaction", { meetingId, emoji });
  };

  const sendQuestion = () => {
    if (!newQuestion.trim() || !socket) return;
    socket.emit("meeting:question", { meetingId, question: newQuestion.trim() });
    setNewQuestion("");
  };

  const endMeeting = () => {
    socket?.emit("meeting:end", { meetingId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnectionsRef.current.forEach(pc => pc.close());
    onLeave();
  };

  const leaveMeeting = () => {
    socket?.emit("meeting:leave", { meetingId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnectionsRef.current.forEach(pc => pc.close());
    onLeave();
  };

  const isHostOrCohost = myRole === "host" || myRole === "cohost";
  const isArl = user?.userType === "arl" || user?.userType === "guest";

  // Filter out self from participants (we render local video separately)
  const remoteParticipants = mySocketId ? participants.filter(p => p.socketId !== mySocketId) : participants;
  // Participants with video (ARLs + guests)
  const videoParticipants = remoteParticipants.filter(p => p.userType === "arl" || p.userType === "guest");
  // All participants for the sidebar
  const allParticipants = remoteParticipants;
  // Presentation mode: someone is sharing their screen
  const isPresentationMode = screenSharing || !!screenSharingParticipant;

  // ── Ref callback for remote video elements ──
  const setRemoteVideoRef = useCallback((socketId: string) => (el: HTMLVideoElement | null) => {
    if (el) {
      remoteVideoRefs.current.set(socketId, el);
      const stream = remoteStreamsRef.current.get(socketId);
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    } else {
      remoteVideoRefs.current.delete(socketId);
    }
  }, []);

  // ── Sidebar content ──
  const sidebarOpen = showChat || showQA || showParticipants;

  // Waiting for host overlay (guest joined before host started)
  if (waitingForHost) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Users className="h-10 w-10 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <div className="inline-flex items-center gap-2 bg-yellow-600/20 text-yellow-400 rounded-full px-5 py-2.5 text-sm font-medium mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for host to start the meeting...
          </div>
          <p className="text-xs text-slate-500 mb-6">You&apos;ll be connected automatically</p>
          <button onClick={onLeave}
            className="px-6 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors">
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-wide">Live</span>
          </div>
          <div className="h-4 w-px bg-slate-600" />
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <span className="text-slate-500 text-xs font-mono">ID: {meetingId.replace(/^scheduled-/, "")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); setShowQA(false); }}
            className={cn("p-2 rounded-lg transition-colors text-slate-300 relative", showParticipants ? "bg-slate-600" : "hover:bg-slate-700")} title="Participants">
            <Users className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">
              {remoteParticipants.length + 1}
            </span>
          </button>
          <button onClick={() => { setShowChat(!showChat); setShowQA(false); setShowParticipants(false); }}
            className={cn("p-2 rounded-lg transition-colors text-slate-300", showChat ? "bg-slate-600" : "hover:bg-slate-700")} title="Chat">
            <MessageCircle className="h-4 w-4" />
          </button>
          <button onClick={() => { setShowQA(!showQA); setShowChat(false); setShowParticipants(false); }}
            className={cn("p-2 rounded-lg transition-colors text-slate-300 relative", showQA ? "bg-slate-600" : "hover:bg-slate-700")} title="Q&A">
            <HelpCircle className="h-4 w-4" />
            {questions.filter(q => !q.isAnswered).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-yellow-400 text-[9px] font-bold text-black flex items-center justify-center">
                {questions.filter(q => !q.isAnswered).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 p-3 overflow-hidden">
            {isPresentationMode ? (
              /* ── Presentation layout: large shared screen + thumbnail strip ── */
              <div className="h-full flex flex-col gap-2">
                {/* Main presentation area */}
                <div className="flex-1 relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-0">
                  {screenSharing ? (
                    /* Local user is sharing */
                    <>
                      <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                        <Monitor className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-white font-medium">{user?.name} (You) — Screen</span>
                      </div>
                    </>
                  ) : screenSharingParticipant ? (
                    /* Remote user is sharing */
                    <>
                      <video ref={setRemoteVideoRef(screenSharingParticipant)} autoPlay playsInline className="w-full h-full object-contain" />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                        <Monitor className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-white font-medium">
                          {videoParticipants.find(p => p.socketId === screenSharingParticipant)?.name || "Participant"} — Screen
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
                {/* Thumbnail strip */}
                <div className="flex gap-2 overflow-x-auto shrink-0" style={{ height: 120 }}>
                  {/* Local video thumbnail (if not the one sharing, or always show small) */}
                  {isArl && (
                    <div className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ width: 160, height: 120 }}>
                      {!screenSharing && <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
                      {screenSharing && (
                        <div className="flex flex-col items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center mb-1">
                            <span className="text-sm font-bold text-white">{user?.name?.charAt(0) || "?"}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{user?.name}</span>
                        </div>
                      )}
                      {!screenSharing && !videoEnabled && (
                        <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center mb-1">
                            <span className="text-sm font-bold text-white">{user?.name?.charAt(0) || "?"}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{user?.name}</span>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5">
                        <span className="text-[9px] text-white">{user?.name}</span>
                      </div>
                    </div>
                  )}
                  {/* Remote video thumbnails (skip the one who is presenting — their video is the main area) */}
                  {videoParticipants.filter(p => p.socketId !== screenSharingParticipant).map(p => (
                    <div key={p.socketId} className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ width: 160, height: 120 }}>
                      <video ref={setRemoteVideoRef(p.socketId)} autoPlay playsInline className="w-full h-full object-cover" />
                      {!p.hasVideo && (
                        <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center mb-1">
                            <span className="text-sm font-bold text-white">{p.name.charAt(0)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{p.name}</span>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5">
                        <span className="text-[9px] text-white">{p.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Normal grid layout ── */
              <div className={cn(
                "h-full grid gap-2",
                (() => {
                  const totalTiles = (isArl ? 1 : 0) + videoParticipants.length;
                  if (totalTiles <= 1) return "grid-cols-1";
                  if (totalTiles === 2) return "grid-cols-2";
                  if (totalTiles === 3) return "grid-cols-3";
                  return "grid-cols-2";
                })(),
              )}>
                {/* Local video (self) — only show if ARL/guest with video capability */}
                {isArl && (
                  <div className="relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {!videoEnabled && (
                      <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
                        <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-2">
                          <span className="text-2xl font-bold text-white">{user?.name?.charAt(0) || "?"}</span>
                        </div>
                        <span className="text-sm text-slate-400">{user?.name} (You)</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                      <span className="text-xs text-white font-medium">{user?.name} (You)</span>
                      {screenSharing && <Monitor className="h-3 w-3 text-blue-400" />}
                      {myRole === "host" && <Crown className="h-3 w-3 text-yellow-400" />}
                      {myRole === "cohost" && <Shield className="h-3 w-3 text-blue-400" />}
                    </div>
                    {!audioEnabled && (
                      <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                        <MicOff className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                )}

                {/* Remote ARL/guest videos */}
                {videoParticipants.map(p => (
                  <div key={p.socketId} className="relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
                    <video ref={setRemoteVideoRef(p.socketId)} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(1)' }} />
                    {!p.hasVideo && (
                      <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
                        <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-2">
                          <span className="text-2xl font-bold text-white">{p.name.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-slate-400">{p.name}</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                      <span className="text-xs text-white font-medium">{p.name}</span>
                      {p.role === "host" && <Crown className="h-3 w-3 text-yellow-400" />}
                      {p.role === "cohost" && <Shield className="h-3 w-3 text-blue-400" />}
                      {p.handRaised && <Hand className="h-3 w-3 text-yellow-400" />}
                    </div>
                    {p.isMuted && (
                      <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                        <MicOff className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}

                {/* If no video participants and user is a restaurant, show a centered placeholder */}
                {!isArl && videoParticipants.length === 0 && (
                  <div className="flex items-center justify-center bg-slate-800 rounded-xl">
                    <div className="text-center">
                      <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3">
                        <Users className="h-10 w-10 text-slate-500" />
                      </div>
                      <p className="text-slate-400 text-sm">Waiting for host to share video...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audio-only participants strip (restaurants) */}
          {remoteParticipants.filter(p => p.userType === "location").length > 0 && (
            <div className="px-3 pb-2 flex gap-2 overflow-x-auto shrink-0">
              {remoteParticipants.filter(p => p.userType === "location").map(p => (
                <div key={p.socketId} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 shrink-0">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    p.hasAudio && !p.isMuted ? "bg-green-600" : "bg-slate-600"
                  )}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-white font-medium truncate block max-w-[100px]">{p.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {p.isMuted ? "Muted" : (p.hasAudio ? "Speaking" : "Muted")}
                    </span>
                  </div>
                  {p.handRaised && <Hand className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                  {p.isMuted && <MicOff className="h-3 w-3 text-red-400 shrink-0" />}
                  {/* Remote audio element (hidden) */}
                  <audio ref={setRemoteVideoRef(p.socketId) as any} autoPlay className="hidden" />
                </div>
              ))}
            </div>
          )}

          {/* Floating reactions — positioned on right edge so they don't block video */}
          <AnimatePresence>
            {floatingReactions.map(r => (
              <motion.div key={r.id} initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -200, scale: 1.5 }} exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: "easeOut" }}
                className="absolute bottom-24 right-4 text-3xl pointer-events-none">
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Reaction bar — right side vertical strip */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-slate-800/80 backdrop-blur-sm rounded-full px-1 py-2">
            {REACTION_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)}
                className="text-lg hover:scale-125 transition-transform p-1 hover:bg-white/10 rounded-full">
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar — full-screen overlay on mobile, side panel on desktop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed inset-0 sm:static sm:inset-auto z-40 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shrink-0 w-full sm:w-auto">

              {/* Participants panel */}
              {showParticipants && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Participants ({remoteParticipants.length + 1})</h3>
                    <button onClick={() => setShowParticipants(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {/* Self */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50">
                      <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">
                        {user?.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white font-medium truncate block">{user?.name} (You)</span>
                        <span className="text-[10px] text-slate-400 capitalize">{myRole}</span>
                      </div>
                      {myRole === "host" && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
                    </div>
                    {/* Others */}
                    {allParticipants.map(p => (
                      <div key={p.socketId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          p.userType === "arl" ? "bg-blue-600" : "bg-slate-600"
                        )}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white font-medium truncate block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{p.role} • {p.userType}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {p.handRaised && <Hand className="h-3.5 w-3.5 text-yellow-400" />}
                          {p.isMuted && <MicOff className="h-3 w-3 text-red-400" />}
                          {p.role === "host" && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
                          {p.role === "cohost" && <Shield className="h-3.5 w-3.5 text-blue-400" />}
                          {/* Host controls — can mute/unmute anyone except the host */}
                          {isHostOrCohost && p.role !== "host" && (
                            <div className="flex gap-1 ml-1">
                              {p.isMuted ? (
                                <button onClick={() => allowSpeak(p.socketId)} title="Allow to speak"
                                  className="p-1 rounded bg-green-600/20 hover:bg-green-600/40 text-green-400">
                                  <Mic className="h-3 w-3" />
                                </button>
                              ) : (
                                <button onClick={() => muteParticipant(p.socketId)} title="Mute"
                                  className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400">
                                  <MicOff className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat panel */}
              {showChat && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Chat</h3>
                    <button onClick={() => setShowChat(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-8">No messages yet</p>
                    ) : messages.map(msg => (
                      <div key={msg.id}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-slate-300">{msg.senderName}</span>
                          {msg.senderType === "arl" && (
                            <span className="text-[9px] font-bold bg-red-600/30 text-red-400 px-1 py-0.5 rounded">ARL</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-200 bg-slate-700/50 rounded-lg p-2">{msg.content}</div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  {!isArl && showMeetingKeyboard && (
                    <OnscreenKeyboard
                      value={newMessage}
                      onChange={setNewMessage}
                      onSubmit={newMessage.trim() ? sendChat : undefined}
                      onDismiss={() => setShowMeetingKeyboard(false)}
                      placeholder="Type a message..."
                    />
                  )}
                  <div className="p-3 border-t border-slate-700 flex gap-2">
                    {!isArl && (
                      <button
                        onClick={() => setShowMeetingKeyboard(k => !k)}
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          showMeetingKeyboard ? "bg-red-600/20 text-red-400" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        )}
                        title="Onscreen keyboard"
                      >
                        <Keyboard className="h-4 w-4" />
                      </button>
                    )}
                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm" />
                    <Button onClick={sendChat} disabled={!newMessage.trim()} size="icon"
                      className="bg-red-600 hover:bg-red-700 h-9 w-9 shrink-0">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Q&A panel */}
              {showQA && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Q&A</h3>
                    <button onClick={() => setShowQA(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {questions.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-8">No questions yet</p>
                    ) : questions.map(q => (
                      <div key={q.id} className={cn("p-3 rounded-lg border", q.isAnswered ? "bg-green-900/20 border-green-800" : "bg-slate-700/50 border-slate-600")}>
                        <div className="text-xs font-medium text-slate-300 mb-1">{q.askerName}</div>
                        <div className="text-sm text-white mb-2">{q.question}</div>
                        <div className="flex items-center justify-between">
                          <button onClick={() => socket?.emit("meeting:upvote-question", { meetingId, questionId: q.id })}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400">
                            <ThumbsUp className="h-3 w-3" /><span>{q.upvotes}</span>
                          </button>
                          <div className="flex items-center gap-2">
                            {q.isAnswered && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3 w-3" />Answered</span>}
                            {isHostOrCohost && !q.isAnswered && (
                              <button onClick={() => socket?.emit("meeting:answer-question", { meetingId, questionId: q.id })}
                                className="text-xs text-green-400 hover:text-green-300 font-medium">Mark Answered</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-700 flex gap-2">
                    <Input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") sendQuestion(); }}
                      placeholder="Ask a question..."
                      className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm" />
                    <Button onClick={sendQuestion} disabled={!newQuestion.trim()} size="icon"
                      className="bg-yellow-600 hover:bg-yellow-700 h-9 w-9 shrink-0">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar (Google Meet style) */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 flex items-center justify-center gap-2 shrink-0">
        {/* Left: meeting info */}
        <div className="flex-1" />

        {/* Center: media controls */}
        <div className="flex items-center gap-2">
          {/* Mic */}
          <button onClick={toggleAudio} disabled={isMutedByHost}
            className={cn("p-3 rounded-full transition-colors",
              audioEnabled ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-600 hover:bg-red-700 text-white",
              isMutedByHost && "opacity-50 cursor-not-allowed"
            )} title={isMutedByHost ? "Muted by host" : (audioEnabled ? "Mute" : "Unmute")}>
            {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Video (ARL only) */}
          {isArl && (
            <button onClick={toggleVideo}
              className={cn("p-3 rounded-full transition-colors",
                videoEnabled ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"
              )} title={videoEnabled ? "Turn off camera" : "Turn on camera"}>
              {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          )}

          {/* Screen share (ARL only) */}
          {isArl && (
            <button onClick={toggleScreenShare}
              className={cn("p-3 rounded-full transition-colors",
                screenSharing ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"
              )} title={screenSharing ? "Stop sharing" : "Share screen"}>
              {screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </button>
          )}

          {/* Raise hand (restaurants) */}
          {!isArl && (
            <button onClick={toggleRaiseHand}
              className={cn("p-3 rounded-full transition-colors",
                handRaised ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"
              )} title={handRaised ? "Lower hand" : "Raise hand"}>
              <Hand className="h-5 w-5" />
            </button>
          )}

          {/* Camera switch (mobile ARL only) */}
          {isArl && (
            <button onClick={async () => {
              const newMode = facingMode === "user" ? "environment" : "user";
              setFacingMode(newMode);
              try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: newMode, width: 1280, height: 720 },
                  audio: true,
                });
                // Replace video track in all peer connections
                const newVideoTrack = newStream.getVideoTracks()[0];
                if (newVideoTrack) {
                  peerConnectionsRef.current.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === "video");
                    if (sender) sender.replaceTrack(newVideoTrack);
                  });
                  // Update local preview
                  const oldStream = localStreamRef.current;
                  if (oldStream) {
                    oldStream.getVideoTracks().forEach(t => t.stop());
                    oldStream.removeTrack(oldStream.getVideoTracks()[0]);
                    oldStream.addTrack(newVideoTrack);
                  }
                  if (localVideoRef.current) {
                    localVideoRef.current.srcObject = oldStream;
                  }
                }
                // Keep existing audio track, stop new one
                newStream.getAudioTracks().forEach(t => t.stop());
              } catch (err) {
                console.error("Camera switch failed:", err);
              }
            }}
              className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              title="Switch camera">
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}

          {/* Leave / End — only host can end for all */}
          {myRole === "host" ? (
            <button onClick={endMeeting}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white px-6" title="End meeting for all">
              <PhoneOff className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={leaveMeeting}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white px-6" title="Leave meeting">
              <PhoneOff className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Right: spacer */}
        <div className="flex-1" />
      </div>
    </div>
  );
}
