"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  PhoneOff, MessageCircle, HelpCircle, Hand, Users,
  Send, CheckCircle, ThumbsUp, X, Crown, Shield,
  Keyboard, Loader2, SwitchCamera,
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
  TrackToggle,
} from "@livekit/components-react";
import { Track, RoomEvent, LocalParticipant, RemoteParticipant } from "livekit-client";
import "@livekit/components-styles";

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
  onLeave: () => void;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏", "💯"];

export function MeetingRoomLiveKitCustom({ meetingId, title, isHost, onLeave }: MeetingRoomLiveKitCustomProps) {
  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

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
          <Button onClick={onLeave}>Go Back</Button>
        </div>
      </div>
    );
  }

  const hasVideoCapability = user?.userType === "arl" || user?.userType === "guest";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900">
      <LiveKitRoom
        video={hasVideoCapability}
        audio={!isHost ? false : true}
        token={token}
        serverUrl={wsUrl}
        data-lk-theme="default"
        style={{ height: "100vh" }}
        onDisconnected={onLeave}
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
  onLeave: () => void;
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
  const [showChat, setShowChat] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [hasUnreadQA, setHasUnreadQA] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [showMeetingKeyboard, setShowMeetingKeyboard] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isArl = user?.userType === "arl" || user?.userType === "guest";
  const isHostOnly = myRole === "host";

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
    };

    socket.on("meeting:chat-message", handleChatMessage);
    socket.on("meeting:question", handleQuestion);
    socket.on("meeting:question-upvoted", handleQuestionUpdate);
    socket.on("meeting:question-answered", handleQuestionUpdate);
    socket.on("meeting:reaction", handleReaction);
    socket.on("meeting:role-updated", handleRoleUpdate);
    socket.on("meeting:waiting-for-host", handleWaitingForHost);
    socket.on("meeting:host-joined", handleHostJoined);

    return () => {
      socket.off("meeting:chat-message", handleChatMessage);
      socket.off("meeting:question", handleQuestion);
      socket.off("meeting:question-upvoted", handleQuestionUpdate);
      socket.off("meeting:question-answered", handleQuestionUpdate);
      socket.off("meeting:reaction", handleReaction);
      socket.off("meeting:role-updated", handleRoleUpdate);
      socket.off("meeting:waiting-for-host", handleWaitingForHost);
      socket.off("meeting:host-joined", handleHostJoined);
    };
  }, [socket, showChat, showQA]);

  // Join meeting via socket
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit("meeting:join", {
      meetingId,
      name: user.name,
      userType: user.userType,
      role: myRole,
    });

    return () => {
      socket.emit("meeting:leave", { meetingId });
    };
  }, [socket, meetingId, user, myRole]);

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

  const toggleRaiseHand = async () => {
    const newState = !handRaised;
    setHandRaised(newState);
    socket?.emit("meeting:hand-raise", { meetingId, raised: newState });
    
    // Update LiveKit metadata so other participants see the hand raise
    try {
      const currentMetadata = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
      const updatedMetadata = JSON.stringify({
        ...currentMetadata,
        handRaised: newState,
      });
      await localParticipant.setMetadata(updatedMetadata);
    } catch (err) {
      console.error("Failed to update hand raise metadata:", err);
    }
  };

  const endMeeting = () => {
    socket?.emit("meeting:end", { meetingId });
    room.disconnect();
    onLeave();
  };

  const leaveMeeting = () => {
    room.disconnect();
    onLeave();
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
            onClick={onLeave}
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
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 p-3 overflow-hidden">
            {isPresentationMode ? (
              /* Presentation layout: large shared screen + thumbnail strip */
              <div className="h-full flex flex-col gap-2">
                {/* Main presentation area */}
                <div className="flex-1 relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-0">
                  {screenShareTrack && screenShareTrack.publication && (
                    <>
                      <VideoTrack
                        trackRef={screenShareTrack as any}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                        <Monitor className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-white font-medium">{screenShareTrack.participant.name} — Screen</span>
                      </div>
                    </>
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
              <div className="h-full flex flex-col gap-2">
                {/* Main host view */}
                <div className="flex-1 relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-0">
                  {localIsHost && hasVideoCapability ? (
                    <>
                      {localParticipant.getTrackPublication(Track.Source.Camera) ? (
                        <VideoTrack
                          trackRef={{
                            participant: localParticipant,
                            source: Track.Source.Camera,
                            publication: localParticipant.getTrackPublication(Track.Source.Camera)!,
                          }}
                          className="w-full h-full object-contain"
                        />
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
                  ) : hostParticipant && hostParticipant.getTrackPublication(Track.Source.Camera) ? (
                    <>
                      <VideoTrack
                        trackRef={{
                          participant: hostParticipant,
                          source: Track.Source.Camera,
                          publication: hostParticipant.getTrackPublication(Track.Source.Camera)!,
                        }}
                        className="w-full h-full object-contain"
                      />
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
                      <p className="text-slate-400 text-sm">Waiting for host to share video...</p>
                    </div>
                  )}
                </div>
                {/* Scrollable participant strip */}
                {otherVideoParticipants.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto shrink-0 pb-1" style={{ height: 120 }}>
                    {/* Remote non-host participants */}
                    {otherVideoParticipants.map((p) => {
                      const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                      const camPub = p.getTrackPublication(Track.Source.Camera);
                      return (
                        <div key={p.identity} className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ width: 160, height: 120 }}>
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
                          </div>
                          {p.isMicrophoneEnabled === false && (
                            <div className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5">
                              <MicOff className="h-2.5 w-2.5 text-white" />
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
            <div className="px-3 pb-2 flex gap-2 overflow-x-auto shrink-0">
              {audioOnlyParticipants.map(p => {
                const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                return (
                  <div key={p.identity} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 shrink-0">
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
                    {metadata.handRaised && <Hand className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
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
                            {metadata.handRaised && <Hand className="h-3.5 w-3.5 text-yellow-400" />}
                            {p.isMicrophoneEnabled === false && <MicOff className="h-3 w-3 text-red-400" />}
                            {metadata.role === "host" && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
                            {metadata.role === "cohost" && <Shield className="h-3.5 w-3.5 text-blue-400" />}
                            {/* Host-only controls - can mute/unmute anyone except themselves */}
                            {isHostOnly && metadata.role !== "host" && !isLocal && (
                              <div className="flex gap-1 ml-1">
                                {p.isMicrophoneEnabled === false ? (
                                  <button
                                    onClick={() => {
                                      // Send unmute request via Socket.io
                                      socket?.emit("meeting:allow-speak", { meetingId, targetSocketId: p.identity });
                                    }}
                                    title="Allow to speak"
                                    className="p-1 rounded bg-green-600/20 hover:bg-green-600/40 text-green-400"
                                  >
                                    <Mic className="h-3 w-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      // Send mute request via Socket.io
                                      socket?.emit("meeting:mute-participant", { meetingId, targetSocketId: p.identity });
                                    }}
                                    title="Mute"
                                    className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400"
                                  >
                                    <MicOff className="h-3 w-3" />
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
                              {isHostOnly && !q.isAnswered && (
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

        {/* Center: media controls */}
        <div className="flex items-center gap-2">
          {/* Mic toggle */}
          <TrackToggle source={Track.Source.Microphone} showIcon={false} className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors">
            <Mic className="h-5 w-5" />
          </TrackToggle>

          {/* Video toggle (ARL only) */}
          {hasVideoCapability && (
            <TrackToggle source={Track.Source.Camera} showIcon={false} className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors">
              <Video className="h-5 w-5" />
            </TrackToggle>
          )}

          {/* Screen share (ARL only) */}
          {isArl && (
            <TrackToggle source={Track.Source.ScreenShare} showIcon={false} captureOptions={{ audio: true, video: true }} className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors">
              <Monitor className="h-5 w-5" />
            </TrackToggle>
          )}

          {/* Raise hand (restaurants) */}
          {!isArl && (
            <button
              onClick={toggleRaiseHand}
              className={cn("p-3 rounded-full transition-colors", handRaised ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-white")}
              title={handRaised ? "Lower hand" : "Raise hand"}
            >
              <Hand className="h-5 w-5" />
            </button>
          )}

          {/* Leave / End */}
          {myRole === "host" ? (
            <button onClick={endMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white px-6" title="End meeting for all">
              <PhoneOff className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white px-6" title="Leave meeting">
              <PhoneOff className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex-1" />
      </div>
    </div>
  );
}
