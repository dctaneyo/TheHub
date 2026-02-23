"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  PhoneOff, MessageCircle, HelpCircle, Hand, Users,
  Send, CheckCircle, ThumbsUp, X, Crown, Shield,
  Keyboard, Loader2, SwitchCamera, Timer, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import {
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  useTracks,
  VideoTrack,
  AudioTrack,
  useRoomContext,
} from "@livekit/components-react";
import { ZoomableVideo } from "./meeting-room/zoomable-video";
import { Track, RoomEvent, LocalParticipant, RemoteParticipant, LocalTrackPublication } from "livekit-client";
import "@livekit/components-styles";
import { LogOut, DoorOpen, Settings, AudioLines } from "lucide-react";
import { RNNoiseProcessor } from "@/lib/rnnoise-processor";

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

interface MeetingRoomLiveKitCustomProps {
  meetingId: string;
  title: string;
  isHost: boolean;
  onLeave: (didEndMeeting?: boolean) => void;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏", "💯"];

export function MeetingRoomLiveKitCustom({ meetingId, title, isHost, onLeave }: MeetingRoomLiveKitCustomProps) {
  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [setupComplete, setSetupComplete] = useState(false);
  const [joinWithVideo, setJoinWithVideo] = useState(false);
  const [joinWithAudio, setJoinWithAudio] = useState(true);

  const hasVideoCapability = user?.userType === "arl" || user?.userType === "guest";

  // Fetch LiveKit token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: meetingId,
            participantName: user?.name || "Guest",
            role: isHost ? "host" : "participant",
            isGuest: user?.userType === "guest",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to get token");
        }

        const data = await res.json();
        setToken(data.token);
        setWsUrl(data.wsUrl);
      } catch (err) {
        console.error("Token fetch error:", err);
        setError("Failed to join meeting. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [meetingId, user?.name]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Connecting to meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <Button onClick={() => onLeave()}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Show setup/lobby page before joining the meeting
  if (!setupComplete) {
    return (
      <MeetingSetup
        title={title}
        meetingId={meetingId}
        hasVideoCapability={hasVideoCapability}
        isHost={isHost}
        userName={user?.name || "Guest"}
        onJoin={(video, audio) => {
          setJoinWithVideo(video);
          setJoinWithAudio(audio);
          setSetupComplete(true);
        }}
        onCancel={() => onLeave()}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900">
      <LiveKitRoom
        video={joinWithVideo}
        audio={joinWithAudio}
        token={token}
        serverUrl={wsUrl}
        data-lk-theme="default"
        style={{ height: "100vh" }}
        onDisconnected={() => onLeave()}
      >
        <MeetingUI
          meetingId={meetingId}
          title={title}
          isHost={isHost}
          onLeave={onLeave}
          hasVideoCapability={hasVideoCapability}
        />
      </LiveKitRoom>
    </div>
  );
}

// ─── Pre-meeting setup / lobby ───
function MeetingSetup({
  title,
  meetingId,
  hasVideoCapability,
  isHost,
  userName,
  onJoin,
  onCancel,
}: {
  title: string;
  meetingId: string;
  hasVideoCapability: boolean;
  isHost: boolean;
  userName: string;
  onJoin: (video: boolean, audio: boolean) => void;
  onCancel: () => void;
}) {
  const [cameraOn, setCameraOn] = useState(hasVideoCapability);
  const [micOn, setMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [permissionError, setPermissionError] = useState<string>("");
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  // Request media permissions on mount
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const requestMedia = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: hasVideoCapability ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = mediaStream;
        setStream(mediaStream);
        setPermissionsGranted(true);
        setPermissionError("");

        // Set up audio analyser for mic level
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(mediaStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Start mic level animation
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(avg / 128, 1)); // normalize 0-1
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (err: any) {
        console.error("Media permission error:", err);
        if (err.name === "NotAllowedError") {
          setPermissionError("Camera/microphone access was denied. Please allow access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setPermissionError("No camera or microphone found. Please connect a device.");
        } else {
          setPermissionError("Could not access camera/microphone. Please check your settings.");
        }
      }
    };

    requestMedia();

    return () => {
      // Cleanup
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    };
  }, [hasVideoCapability]);

  // Attach video stream to preview element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = cameraOn ? stream : null;
    }
  }, [stream, cameraOn]);

  // Toggle camera track
  useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = cameraOn; });
  }, [cameraOn, stream]);

  // Toggle mic track
  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = micOn; });
  }, [micOn, stream]);

  const handleJoin = () => {
    // Stop the preview stream before joining LiveKit (it will create its own)
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close();
    onJoin(cameraOn && hasVideoCapability, micOn);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-lg mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Ready to join?</h1>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-slate-500 text-xs font-mono mt-1">ID: {meetingId.replace(/^scheduled-/, "")}</p>
        </div>

        {/* Camera preview */}
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: "16/9" }}>
          {hasVideoCapability && cameraOn && permissionsGranted ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center mb-3">
                <span className="text-3xl font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm text-slate-400">{userName}</span>
              {!hasVideoCapability && (
                <span className="text-xs text-slate-500 mt-1">Audio only</span>
              )}
              {hasVideoCapability && !cameraOn && (
                <span className="text-xs text-slate-500 mt-1">Camera off</span>
              )}
            </div>
          )}

          {/* Role badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1">
            {isHost ? (
              <>
                <Crown className="h-3 w-3 text-yellow-400" />
                <span className="text-xs text-white font-medium">Host</span>
              </>
            ) : (
              <>
                <Users className="h-3 w-3 text-slate-400" />
                <span className="text-xs text-white font-medium">Participant</span>
              </>
            )}
          </div>

          {/* Mic level indicator */}
          {micOn && permissionsGranted && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
              <Mic className="h-3.5 w-3.5 text-green-400" />
              <div className="flex gap-0.5 items-end h-3">
                {[0.15, 0.3, 0.45, 0.6, 0.75].map((threshold, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1 rounded-full transition-all duration-75",
                      micLevel > threshold ? "bg-green-400" : "bg-slate-600"
                    )}
                    style={{ height: `${(i + 1) * 20}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Permission error */}
        {permissionError && (
          <div className="bg-red-600/20 border border-red-600/40 rounded-xl p-3 mb-4 text-center">
            <p className="text-red-400 text-sm">{permissionError}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {/* Mic toggle */}
          <button
            onClick={() => setMicOn(!micOn)}
            className={cn(
              "flex items-center gap-2 h-11 px-5 rounded-full transition-colors font-medium text-sm",
              micOn
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            {micOn ? "Mic on" : "Mic off"}
          </button>

          {/* Camera toggle (ARLs/guests only) */}
          {hasVideoCapability && (
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className={cn(
                "flex items-center gap-2 h-11 px-5 rounded-full transition-colors font-medium text-sm",
                cameraOn
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              {cameraOn ? "Camera on" : "Camera off"}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            className="h-11 px-6 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            className="h-11 px-8 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors"
          >
            Join Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom meeting UI inside LiveKit room
function MeetingUI({
  meetingId,
  title,
  isHost,
  onLeave,
  hasVideoCapability,
}: {
  meetingId: string;
  title: string;
  isHost: boolean;
  onLeave: (didEndMeeting?: boolean) => void;
  hasVideoCapability: boolean;
}) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // State
  const [myRole, setMyRole] = useState<string>(isHost ? "host" : "participant");
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showParticipants, setShowParticipants] = useState(() => typeof window !== "undefined" && window.innerWidth >= 640);
  const [noiseSuppression, setNoiseSuppression] = useState(false); // RNNoise off by default (user toggles on)
  const rnnoiseRef = useRef<RNNoiseProcessor | null>(null);
  const originalMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [showMeetingKeyboard, setShowMeetingKeyboard] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [hasUnreadQA, setHasUnreadQA] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [hostHasLeft, setHostHasLeft] = useState(false);
  const [hostLeftCountdown, setHostLeftCountdown] = useState<number | null>(null); // seconds remaining
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Loading state while feeds load
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isArl = user?.userType === "arl" || user?.userType === "guest";
  const isHostOrCohost = myRole === "host" || myRole === "cohost";

  // Get video and screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const videoTracks = tracks.filter(t => t.source === Track.Source.Camera);
  const screenShareTrack = tracks.find(t => t.source === Track.Source.ScreenShare);
  const isPresentationMode = !!screenShareTrack;

  // Separate participants by type
  const videoParticipants = participants.filter(p => {
    const metadata = p.metadata ? JSON.parse(p.metadata) : {};
    return metadata.userType === "arl" || metadata.userType === "guest";
  });

  const audioOnlyParticipants = participants.filter(p => {
    const metadata = p.metadata ? JSON.parse(p.metadata) : {};
    return metadata.userType === "location";
  });

  // Find host for host-focused layout
  const hostParticipant = participants.find(p => {
    const metadata = p.metadata ? JSON.parse(p.metadata) : {};
    return metadata.role === "host";
  });

  const localIsHost = myRole === "host";
  const otherVideoParticipants = videoParticipants.filter(p => {
    const metadata = p.metadata ? JSON.parse(p.metadata) : {};
    return metadata.role !== "host";
  });

  // Socket.io event handlers for chat, Q&A, reactions
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
      if (!showChat) setHasUnreadChat(true);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleQuestion = (data: Question) => {
      setQuestions(prev => [...prev, data]);
      if (!showQA) setHasUnreadQA(true);
    };

    const handleQuestionUpdate = (data: { questionId: string; upvotes?: number; isAnswered?: boolean }) => {
      setQuestions(prev =>
        prev.map(q =>
          q.id === data.questionId
            ? { ...q, ...(data.upvotes !== undefined && { upvotes: data.upvotes }), ...(data.isAnswered !== undefined && { isAnswered: data.isAnswered }) }
            : q
        )
      );
    };

    const handleReaction = (data: { emoji: string }) => {
      const id = Math.random().toString(36);
      setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, x: Math.random() * 80 + 10 }]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    };

    const handleRoleUpdate = (data: { socketId: string; role: string }) => {
      if (data.socketId === socket.id) {
        setMyRole(data.role);
      }
    };

    const handleWaitingForHost = () => {
      setWaitingForHost(true);
    };

    const handleHostJoined = () => {
      setWaitingForHost(false);
      setHostHasLeft(false);
      setHostLeftCountdown(null);
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    };

    const handleHostLeft = () => {
      setHostHasLeft(true);
    };

    const handleHostLeftCountdown = (data: { secondsRemaining: number; hostName?: string }) => {
      setHostHasLeft(true);
      setHostLeftCountdown(data.secondsRemaining);
      // Start a local 1-second interval to tick down the counter smoothly
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      let remaining = data.secondsRemaining;
      countdownIntervalRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          setHostLeftCountdown(0);
        } else {
          setHostLeftCountdown(remaining);
        }
      }, 1000);
    };

    const handleHostTransferred = (data: { newHostName: string; previousHostName: string; newHostIdentity?: string }) => {
      setHostHasLeft(false);
      setHostLeftCountdown(null);
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
      
      // Check if we're the new host by comparing LiveKit identity
      const myIdentity = localParticipant.identity;
      if (data.newHostIdentity === myIdentity) {
        // This user is the new host
        setMyRole("host");
        setNotification({ message: `You are now the host! ${data.previousHostName} transferred host duties to you.`, type: 'success' });
      } else {
        // If we were the host before, demote to cohost
        if (myRole === "host") {
          setMyRole("cohost");
          setNotification({ message: `You transferred host to ${data.newHostName}. You are now a co-host.`, type: 'info' });
        } else {
          setNotification({ message: `${data.previousHostName} transferred host to ${data.newHostName}.`, type: 'info' });
        }
      }
      setTimeout(() => setNotification(null), 8000);
    };

    // Hand raise events from server — track by odId which matches LiveKit identity
    const handleHandRaised = (data: { socketId: string; odId: string; name: string }) => {
      setRaisedHands(prev => {
        const next = new Set(prev);
        next.add(data.odId);
        next.add(data.socketId); // also track by socketId for fallback
        return next;
      });
    };

    const handleHandLowered = (data: { socketId: string; odId: string }) => {
      setRaisedHands(prev => {
        const next = new Set(prev);
        next.delete(data.odId);
        next.delete(data.socketId);
        return next;
      });
    };

    // When we join, server tells us our actual role (ARLs get "cohost")
    const handleJoined = (data: { yourRole: string }) => {
      if (data.yourRole) setMyRole(data.yourRole);
    };

    // Mute/unmute events from server (when host mutes/unmutes us)
    // Now broadcasts to all participants with targetIdentity - check if it matches our LiveKit identity
    const handleYouWereMuted = (data: { targetIdentity?: string }) => {
      const myIdentity = localParticipant.identity;
      // If targetIdentity is specified, only apply if it matches us
      if (data?.targetIdentity && data.targetIdentity !== myIdentity) {
        return; // Not for us
      }
      console.log(`🔇 Muted by host (targetIdentity: ${data?.targetIdentity}, myIdentity: ${myIdentity})`);
      localParticipant.setMicrophoneEnabled(false);
    };

    const handleSpeakAllowed = (data: { targetIdentity?: string }) => {
      const myIdentity = localParticipant.identity;
      // If targetIdentity is specified, only apply if it matches us
      if (data?.targetIdentity && data.targetIdentity !== myIdentity) {
        return; // Not for us
      }
      console.log(`🎤 Unmuted by host (targetIdentity: ${data?.targetIdentity}, myIdentity: ${myIdentity})`);
      localParticipant.setMicrophoneEnabled(true);
    };

    // When host ends the meeting, disconnect everyone
    const handleMeetingEnded = () => {
      room.disconnect();
      onLeave();
    };

    socket.on("meeting:chat-message", handleChatMessage);
    socket.on("meeting:question", handleQuestion);
    socket.on("meeting:question-upvoted", handleQuestionUpdate);
    socket.on("meeting:question-answered", handleQuestionUpdate);
    socket.on("meeting:reaction", handleReaction);
    socket.on("meeting:role-updated", handleRoleUpdate);
    socket.on("meeting:waiting-for-host", handleWaitingForHost);
    socket.on("meeting:host-joined", handleHostJoined);
    socket.on("meeting:host-left", handleHostLeft);
    socket.on("meeting:host-left-countdown", handleHostLeftCountdown);
    socket.on("meeting:host-transferred", handleHostTransferred);
    socket.on("meeting:hand-raised", handleHandRaised);
    socket.on("meeting:hand-lowered", handleHandLowered);
    socket.on("meeting:you-were-muted", handleYouWereMuted);
    socket.on("meeting:speak-allowed", handleSpeakAllowed);
    socket.on("meeting:joined", handleJoined);
    socket.on("meeting:ended", handleMeetingEnded);

    return () => {
      socket.off("meeting:chat-message", handleChatMessage);
      socket.off("meeting:question", handleQuestion);
      socket.off("meeting:question-upvoted", handleQuestionUpdate);
      socket.off("meeting:question-answered", handleQuestionUpdate);
      socket.off("meeting:reaction", handleReaction);
      socket.off("meeting:role-updated", handleRoleUpdate);
      socket.off("meeting:waiting-for-host", handleWaitingForHost);
      socket.off("meeting:host-joined", handleHostJoined);
      socket.off("meeting:host-left", handleHostLeft);
      socket.off("meeting:host-left-countdown", handleHostLeftCountdown);
      socket.off("meeting:host-transferred", handleHostTransferred);
      socket.off("meeting:hand-raised", handleHandRaised);
      socket.off("meeting:hand-lowered", handleHandLowered);
      socket.off("meeting:you-were-muted", handleYouWereMuted);
      socket.off("meeting:speak-allowed", handleSpeakAllowed);
      socket.off("meeting:joined", handleJoined);
      socket.off("meeting:ended", handleMeetingEnded);
    };
  }, [socket, showChat, showQA, localParticipant, room, onLeave]);

  // Join meeting via socket — use RoomEvent.Connected for reliability
  const hasJoinedRef = useRef(false);
  useEffect(() => {
    if (!socket || !user) return;

    const emitJoin = () => {
      if (hasJoinedRef.current) return;
      const identity = localParticipant.identity;
      if (!identity) return;
      
      hasJoinedRef.current = true;
      console.log(`[MeetingRoom] Emitting meeting:join with identity=${identity}`);
      socket.emit("meeting:join", {
        meetingId,
        hasVideo: false,
        hasAudio: true,
        name: user.name,
        userType: user.userType,
        role: isHost ? "host" : "participant",
        livekitIdentity: identity,
      });
    };

    // Try immediately if already connected
    if (room.state === "connected" && localParticipant.identity) {
      emitJoin();
    }

    // Also listen for connection event in case we're not connected yet
    const handleConnected = () => {
      // Small delay to ensure identity is populated
      setTimeout(emitJoin, 100);
    };
    room.on(RoomEvent.Connected, handleConnected);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      if (hasJoinedRef.current) {
        socket.emit("meeting:leave", { meetingId });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, meetingId, user?.id, room, localParticipant.identity]);

  // Apply RNNoise noise suppression to microphone track
  useEffect(() => {
    let cancelled = false;

    const toggleRNNoise = async () => {
      const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (!micPub?.track) return;

      try {
        if (noiseSuppression) {
          // Enable: pipe mic through RNNoise
          if (rnnoiseRef.current?.isActive) return; // already active

          const originalTrack = micPub.track.mediaStreamTrack;
          originalMicTrackRef.current = originalTrack.clone(); // save a clone to restore later

          const processor = new RNNoiseProcessor();
          const processedTrack = await processor.start(originalTrack);
          if (cancelled) { processor.stop(); return; }

          rnnoiseRef.current = processor;

          // Replace the mic track in LiveKit with the RNNoise-processed version
          await (micPub as any).track.replaceTrack(processedTrack);
          console.log("✅ RNNoise noise suppression enabled");
        } else {
          // Disable: restore original mic track
          if (!rnnoiseRef.current?.isActive) return;

          rnnoiseRef.current.stop();
          rnnoiseRef.current = null;

          // Restore original track
          if (originalMicTrackRef.current) {
            // Get a fresh mic track since the original may have been stopped
            try {
              const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const freshTrack = freshStream.getAudioTracks()[0];
              await (micPub as any).track.replaceTrack(freshTrack);
              originalMicTrackRef.current = null;
            } catch {
              // If we can't get a fresh track, just disable and re-enable the mic
              await localParticipant.setMicrophoneEnabled(false);
              await localParticipant.setMicrophoneEnabled(true);
            }
          }
          console.log("❌ RNNoise noise suppression disabled");
        }
      } catch (err) {
        console.error("RNNoise error:", err);
      }
    };

    toggleRNNoise();

    return () => {
      cancelled = true;
    };
  }, [noiseSuppression, localParticipant]);

  // Cleanup RNNoise + countdown interval on unmount
  useEffect(() => {
    return () => {
      if (rnnoiseRef.current?.isActive) {
        rnnoiseRef.current.stop();
        rnnoiseRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // Clear loading state once we have participants and room is connected
  useEffect(() => {
    if (room.state === "connected" && participants.length > 0) {
      // Small delay to let video feeds initialize
      const timer = setTimeout(() => setIsInitializing(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [room.state, participants.length]);

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

  const toggleRaiseHand = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    // Use correct server event names
    if (newState) {
      socket?.emit("meeting:raise-hand", { meetingId });
    } else {
      socket?.emit("meeting:lower-hand", { meetingId });
    }
  };

  const endMeeting = () => {
    socket?.emit("meeting:end", { meetingId });
    // Delay disconnect to ensure the server processes the end event and
    // broadcasts meeting:ended to all participants before our socket drops
    setTimeout(() => {
      room.disconnect();
      onLeave(true); // true = meeting ended (not just left)
    }, 500);
  };

  const leaveMeeting = () => {
    socket?.emit("meeting:leave", { meetingId });
    room.disconnect();
    onLeave(false); // false = just left (meeting may continue)
  };

  const transferHost = (targetIdentity: string, targetName?: string) => {
    socket?.emit("meeting:transfer-host", { meetingId, targetIdentity, targetName });
    setShowTransferDialog(false);
  };

  // Helper: check if a participant has raised hand (by socket or LiveKit identity)
  const isHandRaised = (p: any): boolean => {
    // Check via our socket-based raisedHands set
    if (raisedHands.has(p.identity)) return true;
    // Also check metadata as fallback
    try {
      const meta = p.metadata ? JSON.parse(p.metadata) : {};
      return !!meta.handRaised;
    } catch { return false; }
  };

  const sidebarOpen = showChat || showQA || showParticipants;

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
          <button
            onClick={() => onLeave()}
            className="px-6 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Override LiveKit's default video object-fit to prevent cropping on host video */}
      <style>{`
        .lk-host-video video { object-fit: contain !important; }
      `}</style>
      {/* Loading overlay while meeting initializes */}
      {isInitializing && (
        <div className="absolute inset-0 z-[70] bg-slate-900/95 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 text-red-500 animate-spin" />
          <div className="text-center">
            <h3 className="text-white font-semibold text-lg mb-1">Joining Meeting</h3>
            <p className="text-slate-400 text-sm">Connecting to {title}...</p>
          </div>
        </div>
      )}

      {/* Notification banner (host transfer, etc.) */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "px-4 py-2.5 flex items-center justify-center gap-2 shrink-0 text-white text-sm font-medium",
              notification.type === 'success' ? "bg-green-600/90" : 
              notification.type === 'warning' ? "bg-orange-600/90" : "bg-blue-600/90"
            )}
          >
            {notification.type === 'success' && <Crown className="h-4 w-4" />}
            {notification.message}
            <button onClick={() => setNotification(null)} className="ml-2 p-0.5 hover:bg-white/20 rounded">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host-left countdown banner */}
      {hostHasLeft && hostLeftCountdown !== null && hostLeftCountdown > 0 && (
        <div className="bg-orange-600/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2 shrink-0">
          <Timer className="h-4 w-4 text-white animate-pulse" />
          <span className="text-white text-sm font-medium">
            Host has left — meeting ends in {Math.floor(hostLeftCountdown / 60)}:{String(hostLeftCountdown % 60).padStart(2, "0")}
          </span>
        </div>
      )}

      {/* Host transfer dialog */}
      <AnimatePresence>
        {showTransferDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowTransferDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-bold text-base mb-1">Transfer Host Role</h3>
              <p className="text-slate-400 text-xs mb-4">Select a participant to become the new host. You will become a co-host.</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {participants.filter(p => p !== localParticipant).map(p => {
                  const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                  return (
                    <button
                      key={p.identity}
                      onClick={() => transferHost(p.identity, p.name)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                        metadata.userType === "arl" ? "bg-blue-600" : metadata.userType === "guest" ? "bg-purple-600" : "bg-slate-600"
                      )}>
                        {p.name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white font-medium truncate block">{p.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{metadata.userType || "participant"}</span>
                      </div>
                      <ArrowRightLeft className="h-4 w-4 text-slate-500" />
                    </button>
                  );
                })}
                {participants.filter(p => p !== localParticipant).length === 0 && (
                  <p className="text-slate-500 text-xs text-center py-4">No other participants to transfer to</p>
                )}
              </div>
              <button
                onClick={() => setShowTransferDialog(false)}
                className="mt-3 w-full h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <button
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
              setShowQA(false);
            }}
            className={cn("p-2 rounded-lg transition-colors text-slate-300 relative", showParticipants ? "bg-slate-600" : "hover:bg-slate-700")}
            title="Participants"
          >
            <Users className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">
              {participants.length}
            </span>
          </button>
          <button
            onClick={() => {
              setShowChat(!showChat);
              setShowQA(false);
              setShowParticipants(false);
              if (!showChat) setHasUnreadChat(false);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors text-slate-300 relative",
              showChat ? "bg-slate-600" : "hover:bg-slate-700",
              hasUnreadChat && !showChat && "animate-pulse ring-2 ring-green-400/60 bg-green-500/20"
            )}
            title="Chat"
          >
            <MessageCircle className="h-4 w-4" />
            {hasUnreadChat && !showChat && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 animate-ping" />}
          </button>
          <button
            onClick={() => {
              setShowQA(!showQA);
              setShowChat(false);
              setShowParticipants(false);
              if (!showQA) setHasUnreadQA(false);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors text-slate-300 relative",
              showQA ? "bg-slate-600" : "hover:bg-slate-700",
              hasUnreadQA && !showQA && "animate-pulse ring-2 ring-yellow-400/60 bg-yellow-500/20"
            )}
            title="Q&A"
          >
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
      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Video grid */}
        <div className="flex-1 flex flex-col relative min-w-0">
          <div className="flex-1 p-3 overflow-hidden min-w-0">
            {isPresentationMode ? (
              /* Presentation layout: large shared screen + thumbnail strip */
              <div className="h-full flex flex-col gap-2">
                {/* Main presentation area */}
                <div className="flex-1 relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-0">
                  {screenShareTrack && screenShareTrack.publication && (
                    <ZoomableVideo
                      trackRef={screenShareTrack as any}
                      className="w-full h-full"
                    >
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                        <Monitor className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-white font-medium">{screenShareTrack.participant.name} — Screen</span>
                      </div>
                    </ZoomableVideo>
                  )}
                </div>
                {/* Thumbnail strip */}
                <div className="flex gap-2 overflow-x-auto shrink-0" style={{ height: 120 }}>
                  {videoTracks.filter(t => t.publication).map(track => (
                    <div key={track.participant.identity} className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ width: 160, height: 120 }}>
                      <VideoTrack trackRef={track as any} className="w-full h-full object-cover" />
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5">
                        <span className="text-[9px] text-white">{track.participant.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Host-focused layout: host big + scrollable participant strip */
              <div className="h-full flex flex-col gap-2 min-w-0">
                {/* Main host view */}
                <div className="flex-1 relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-0">
                  {localIsHost && hasVideoCapability ? (
                    <>
                      {localParticipant.getTrackPublication(Track.Source.Camera) ? (
                        <div className="lk-host-video w-full h-full">
                          <VideoTrack
                            trackRef={{
                              participant: localParticipant,
                              source: Track.Source.Camera,
                              publication: localParticipant.getTrackPublication(Track.Source.Camera)!,
                            }}
                            className="w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
                          <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center mb-2">
                            <span className="text-3xl font-bold text-white">{user?.name?.charAt(0) || "?"}</span>
                          </div>
                          <span className="text-sm text-slate-400">{user?.name} (You)</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                        <span className="text-xs text-white font-medium">{user?.name} (You)</span>
                        <Crown className="h-3 w-3 text-yellow-400" />
                      </div>
                      {localParticipant.isMicrophoneEnabled === false && (
                        <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </>
                  ) : hostParticipant ? (
                    <>
                      {/* Host with or without video */}
                      {hostParticipant.getTrackPublication(Track.Source.Camera) ? (
                        <div className="lk-host-video w-full h-full">
                          <VideoTrack
                            trackRef={{
                              participant: hostParticipant,
                              source: Track.Source.Camera,
                              publication: hostParticipant.getTrackPublication(Track.Source.Camera)!,
                            }}
                            className="w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                          <div className="text-center">
                            <div className="h-24 w-24 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-3 text-white text-3xl font-bold">
                              {hostParticipant.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'H'}
                            </div>
                            <p className="text-white font-medium">{hostParticipant.name}</p>
                            <p className="text-slate-400 text-xs mt-1">Camera off</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                        <span className="text-xs text-white font-medium">{hostParticipant.name}</span>
                        <Crown className="h-3 w-3 text-yellow-400" />
                      </div>
                      {hostParticipant.isMicrophoneEnabled === false && (
                        <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3">
                        <Users className="h-10 w-10 text-slate-500" />
                      </div>
                      <p className="text-slate-400 text-sm">
                        {hostHasLeft
                          ? "Host has left the meeting..."
                          : "Waiting for host to join..."}
                      </p>
                    </div>
                  )}
                </div>
                {/* Scrollable participant strip */}
                {otherVideoParticipants.length > 0 && (
                  <div 
                    className="flex gap-2 overflow-x-scroll overflow-y-hidden shrink-0 pb-1 -mx-3 px-3" 
                    style={{ 
                      height: 120, 
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'thin',
                      touchAction: 'pan-x',
                      scrollSnapType: 'x proximity'
                    }}
                  >
                    {/* Remote non-host participants */}
                    {otherVideoParticipants.map((p) => {
                      const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                      const camPub = p.getTrackPublication(Track.Source.Camera);
                      return (
                        <div key={p.identity} className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ width: 160, height: 120, scrollSnapAlign: 'start' }}>
                          {camPub ? (
                            <VideoTrack
                              trackRef={{
                                participant: p,
                                source: Track.Source.Camera,
                                publication: camPub,
                              }}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center mb-1">
                                <span className="text-sm font-bold text-white">{p.name?.charAt(0) || "?"}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">{p.name}</span>
                            </div>
                          )}
                          <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5">
                            <span className="text-[9px] text-white">{p.name}</span>
                            {metadata.role === "cohost" && <Shield className="inline h-2.5 w-2.5 text-blue-400 ml-1" />}
                            {isHandRaised(p) && <Hand className="inline h-2.5 w-2.5 text-yellow-400 ml-1" />}
                          </div>
                          {p.isMicrophoneEnabled === false && (
                            <div className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5">
                              <MicOff className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                          {isHandRaised(p) && (
                            <div className="absolute top-1 left-1 bg-yellow-600 rounded-full p-0.5">
                              <Hand className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audio-only participants strip (restaurants) */}
          {audioOnlyParticipants.length > 0 && (
            <div 
              className="px-3 pb-2 flex gap-2 overflow-x-scroll overflow-y-hidden shrink-0" 
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                touchAction: 'pan-x',
                scrollSnapType: 'x proximity'
              }}
            >
              {audioOnlyParticipants.map(p => {
                const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                return (
                  <div key={p.identity} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                        p.isMicrophoneEnabled ? "bg-green-600" : "bg-slate-600"
                      )}
                    >
                      {p.name?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-white font-medium truncate block max-w-[100px]">{p.name}</span>
                      <span className="text-[10px] text-slate-400">{p.isMicrophoneEnabled ? "Speaking" : "Muted"}</span>
                    </div>
                    {isHandRaised(p) && <Hand className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                    {p.isMicrophoneEnabled === false && <MicOff className="h-3 w-3 text-red-400 shrink-0" />}
                    {/* Audio track */}
                    {p.getTrackPublication(Track.Source.Microphone) && (
                      <AudioTrack
                        trackRef={{
                          participant: p,
                          source: Track.Source.Microphone,
                          publication: p.getTrackPublication(Track.Source.Microphone)!,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating reactions */}
          <AnimatePresence>
            {floatingReactions.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -200, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: "easeOut" }}
                className="absolute bottom-24 right-4 text-3xl pointer-events-none"
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Reaction bar */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-slate-800/80 backdrop-blur-sm rounded-full px-1 py-2">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-lg hover:scale-125 transition-transform p-1 hover:bg-white/10 rounded-full"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 sm:static sm:inset-auto z-40 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shrink-0 w-full sm:w-auto"
            >
              {/* Participants panel */}
              {showParticipants && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Participants ({participants.length})</h3>
                    <button onClick={() => setShowParticipants(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {participants.map(p => {
                      const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                      const isLocal = p === localParticipant;
                      return (
                        <div key={p.identity} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                              isLocal ? "bg-red-600" : metadata.userType === "arl" ? "bg-blue-600" : "bg-slate-600"
                            )}
                          >
                            {p.name?.charAt(0) || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white font-medium truncate block">
                              {p.name} {isLocal && "(You)"}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize">
                              {metadata.role || "participant"} • {metadata.userType || "guest"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isHandRaised(p) && <Hand className="h-3.5 w-3.5 text-yellow-400" />}
                            {p.isMicrophoneEnabled === false && <MicOff className="h-3 w-3 text-red-400" />}
                            {metadata.role === "host" && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
                            {metadata.role === "cohost" && <Shield className="h-3.5 w-3.5 text-blue-400" />}
                            {/* Host/cohost controls - can mute/unmute anyone except the host */}
                            {isHostOrCohost && metadata.role !== "host" && !isLocal && (
                              <div className="flex gap-2 ml-2">
                                {p.isMicrophoneEnabled === false ? (
                                  <button
                                    onClick={() => {
                                      // Send unmute request via Socket.io (using LiveKit identity)
                                      socket?.emit("meeting:allow-speak", { meetingId, targetIdentity: p.identity });
                                    }}
                                    title="Allow to speak"
                                    className="p-2.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 active:scale-95 transition-transform"
                                  >
                                    <Mic className="h-5 w-5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      // Send mute request via Socket.io (using LiveKit identity)
                                      socket?.emit("meeting:mute-participant", { meetingId, targetIdentity: p.identity });
                                    }}
                                    title="Mute"
                                    className="p-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 active:scale-95 transition-transform"
                                  >
                                    <MicOff className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chat panel */}
              {showChat && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">Chat</h3>
                    <button onClick={() => setShowChat(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-8">No messages yet</p>
                    ) : (
                      messages.map(msg => (
                        <div key={msg.id}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-slate-300">{msg.senderName}</span>
                            {msg.senderType === "arl" && <span className="text-[9px] font-bold bg-red-600/30 text-red-400 px-1 py-0.5 rounded">ARL</span>}
                          </div>
                          <div className="text-sm text-slate-200 bg-slate-700/50 rounded-lg p-2">{msg.content}</div>
                        </div>
                      ))
                    )}
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
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") sendChat();
                      }}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm"
                    />
                    <Button onClick={sendChat} disabled={!newMessage.trim()} size="icon" className="bg-red-600 hover:bg-red-700 h-9 w-9 shrink-0">
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
                    <button onClick={() => setShowQA(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {questions.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-8">No questions yet</p>
                    ) : (
                      questions.map(q => (
                        <div key={q.id} className={cn("p-3 rounded-lg border", q.isAnswered ? "bg-green-900/20 border-green-800" : "bg-slate-700/50 border-slate-600")}>
                          <div className="text-xs font-medium text-slate-300 mb-1">{q.askerName}</div>
                          <div className="text-sm text-white mb-2">{q.question}</div>
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => socket?.emit("meeting:upvote-question", { meetingId, questionId: q.id })}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400"
                            >
                              <ThumbsUp className="h-3 w-3" />
                              <span>{q.upvotes}</span>
                            </button>
                            <div className="flex items-center gap-2">
                              {q.isAnswered && (
                                <span className="flex items-center gap-1 text-xs text-green-400">
                                  <CheckCircle className="h-3 w-3" />
                                  Answered
                                </span>
                              )}
                              {isHostOrCohost && !q.isAnswered && (
                                <button
                                  onClick={() => socket?.emit("meeting:answer-question", { meetingId, questionId: q.id })}
                                  className="text-xs text-green-400 hover:text-green-300 font-medium"
                                >
                                  Mark Answered
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-700 flex gap-2">
                    <Input
                      value={newQuestion}
                      onChange={e => setNewQuestion(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") sendQuestion();
                      }}
                      placeholder="Ask a question..."
                      className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm"
                    />
                    <Button onClick={sendQuestion} disabled={!newQuestion.trim()} size="icon" className="bg-yellow-600 hover:bg-yellow-700 h-9 w-9 shrink-0">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 flex items-center justify-center gap-2 shrink-0">
        <div className="flex-1" />

        {/* Center: media controls — all pill-shaped custom buttons */}
        <div className="flex items-center gap-2">
          {/* Mic toggle */}
          <button
            onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
            className={cn(
              "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
              localParticipant.isMicrophoneEnabled
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            )}
            title={localParticipant.isMicrophoneEnabled ? "Mute" : "Unmute"}
          >
            {localParticipant.isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Video toggle (ARL only) */}
          {hasVideoCapability && (
            <button
              onClick={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
              className={cn(
                "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
                localParticipant.isCameraEnabled
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
              title={localParticipant.isCameraEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {localParticipant.isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          )}

          {/* Screen share (ARL only) */}
          {isArl && (
            <button
              onClick={() => localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled)}
              className={cn(
                "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
                localParticipant.isScreenShareEnabled
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              )}
              title={localParticipant.isScreenShareEnabled ? "Stop sharing" : "Share screen"}
            >
              {localParticipant.isScreenShareEnabled ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </button>
          )}

          {/* RNNoise noise suppression toggle */}
          <button
            onClick={() => setNoiseSuppression(!noiseSuppression)}
            className={cn(
              "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
              noiseSuppression
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            )}
            title={noiseSuppression ? "RNNoise: ON (click to disable)" : "RNNoise: OFF (click to enable)"}
          >
            <AudioLines className="h-5 w-5" />
          </button>

          {/* Raise hand (restaurants + guests) */}
          {(user?.userType === "location" || user?.userType === "guest") && (
            <button
              onClick={toggleRaiseHand}
              className={cn("flex items-center justify-center h-10 px-4 rounded-full transition-colors", handRaised ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-white")}
              title={handRaised ? "Lower hand" : "Raise hand"}
            >
              <Hand className="h-5 w-5" />
            </button>
          )}

          {/* Host: Transfer + Leave + End Meeting buttons */}
          {myRole === "host" ? (
            <>
              <button
                onClick={() => setShowTransferDialog(true)}
                className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                title="Transfer host role to another participant"
              >
                <ArrowRightLeft className="h-5 w-5" />
                <span className="text-xs font-medium hidden sm:inline">Transfer</span>
              </button>
              <button
                onClick={leaveMeeting}
                className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                title="Leave meeting (meeting continues)"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-xs font-medium hidden sm:inline">Leave</span>
              </button>
              <button
                onClick={endMeeting}
                className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                title="End meeting for all"
              >
                <PhoneOff className="h-5 w-5" />
                <span className="text-xs font-medium hidden sm:inline">End</span>
              </button>
            </>
          ) : (
            <button
              onClick={leaveMeeting}
              className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Leave meeting"
            >
              <PhoneOff className="h-5 w-5" />
              <span className="text-xs font-medium hidden sm:inline">Leave</span>
            </button>
          )}
        </div>

        <div className="flex-1" />
      </div>
    </div>
  );
}
