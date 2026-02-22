"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  MonitorOff,
  Users,
  MessageCircle,
  HelpCircle,
  X,
  Play,
  Square,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";

// WebRTC configuration - defined outside component to prevent re-renders
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceTransportPolicy: "all",
};

interface BroadcastStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Viewer {
  id: string;
  viewerName: string;
  joinedAt: string;
  isMinimized: boolean;
}

interface StreamMessage {
  id: string;
  senderName: string;
  content: string;
  timestamp: number;
}

interface StreamQuestion {
  id: string;
  askerName: string;
  question: string;
  upvotes: number;
  isAnswered: boolean;
}

export function BroadcastStudio({ isOpen, onClose }: BroadcastStudioProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [streamMode, setStreamMode] = useState<"video" | "audio" | "text">("video");
  const [targetAudience, setTargetAudience] = useState<"all" | "specific">("all");
  
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenShare, setScreenShare] = useState(false);
  
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [questions, setQuestions] = useState<StreamQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<"viewers" | "chat" | "questions">("viewers");
  
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  const { socket } = useSocket();

  // Start broadcast
  const startBroadcast = async () => {
    if (!title.trim()) {
      alert("Please enter a broadcast title");
      return;
    }

    try {
      // Request camera/mic permissions
      if (streamMode === "video" || streamMode === "audio") {
        try {
          const constraints = {
            video: streamMode === "video" ? { width: 1280, height: 720 } : false,
            audio: true,
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          
          console.log("Media stream obtained:", stream);
          console.log("Video tracks:", stream.getVideoTracks());
          console.log("Audio tracks:", stream.getAudioTracks());
          
          // Video preview will be set by useEffect after component renders
        } catch (mediaError: any) {
          console.error("Media error:", mediaError);
          alert(`Camera/Microphone error: ${mediaError.message || "Permission denied"}`);
          return;
        }
      }

      // Create broadcast in database
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          streamMode,
          targetAudience,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setBroadcastId(data.broadcastId);
      setIsStreaming(true);
      startTimeRef.current = Date.now();
      
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Emit stream started event via socket
      if (socket) {
        socket.emit("broadcast:start", { broadcastId: data.broadcastId, title });
      }
    } catch (error: any) {
      console.error("Failed to start broadcast:", error);
      alert(`Failed to start broadcast: ${error.message || "Unknown error"}`);
      
      // Clean up media stream if it was created
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  // End broadcast
  const endBroadcast = async () => {
    if (!broadcastId) return;

    try {
      // Stop media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clear duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();

      // Update broadcast status
      await fetch("/api/broadcasts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastId,
          status: "ended",
          duration,
        }),
      });

      // Emit stream ended event
      if (socket) {
        socket.emit("broadcast:end", { broadcastId });
      }

      setIsStreaming(false);
      setBroadcastId(null);
      setDuration(0);
      setViewers([]);
      setMessages([]);
      setQuestions([]);
    } catch (error) {
      console.error("Failed to end broadcast:", error);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Socket listeners
  useEffect(() => {
    if (!socket || !isStreaming || !broadcastId) return;

    const handleViewerJoin = (data: { viewerId: string; viewerName: string }) => {
      setViewers(prev => [...prev, {
        id: data.viewerId,
        viewerName: data.viewerName,
        joinedAt: new Date().toISOString(),
        isMinimized: false,
      }]);
    };

    const handleViewerLeave = (data: { viewerId: string }) => {
      setViewers(prev => prev.filter(v => v.id !== data.viewerId));
      // Close peer connection for this viewer
      const pc = peerConnectionsRef.current.get(data.viewerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.viewerId);
      }
    };

    const handleStreamMessage = (data: StreamMessage) => {
      setMessages(prev => [...prev, data]);
    };

    const handleStreamQuestion = (data: StreamQuestion) => {
      setQuestions(prev => [...prev, data]);
    };

    // WebRTC: Handle offer request from viewer
    const handleOfferRequested = async (data: { broadcastId: string; viewerId: string; viewerSocketId: string }) => {
      if (data.broadcastId !== broadcastId || !streamRef.current) return;

      try {
        // Create new peer connection for this viewer
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionsRef.current.set(data.viewerId, pc);

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          console.log(`Peer connection state for viewer ${data.viewerId}:`, pc.connectionState);
        };
        
        pc.oniceconnectionstatechange = () => {
          console.log(`ICE connection state for viewer ${data.viewerId}:`, pc.iceConnectionState);
        };
        
        // Monitor ICE gathering state
        pc.onicegatheringstatechange = () => {
          console.log(`ICE gathering state for viewer ${data.viewerId}:`, pc.iceGatheringState);
        };

        // Add all tracks from the media stream
        console.log("Adding tracks to peer connection for viewer:", data.viewerId);
        console.log("Stream active:", streamRef.current.active);
        console.log("Stream ID:", streamRef.current.id);
        
        streamRef.current.getTracks().forEach(track => {
          console.log("Adding track:", track.kind, track.label);
          console.log("  - enabled:", track.enabled);
          console.log("  - readyState:", track.readyState);
          console.log("  - muted:", track.muted);
          
          if (track.kind === "video") {
            const settings = track.getSettings();
            console.log("  - video settings:", settings);
          }
          
          const sender = pc.addTrack(track, streamRef.current!);
          console.log("  - sender track:", sender.track?.kind, sender.track?.enabled);
          
          // Ensure transceiver is set to sendonly
          const transceiver = pc.getTransceivers().find(t => t.sender === sender);
          if (transceiver) {
            transceiver.direction = "sendonly";
            console.log("  - transceiver direction set to:", transceiver.direction);
          }
        });

        // Handle ICE candidates - send them as they're discovered
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("Sending ICE candidate to viewer:", data.viewerId);
            socket.emit("webrtc:ice-candidate", {
              targetSocketId: data.viewerSocketId,
              candidate: event.candidate.toJSON(),
            });
          } else {
            console.log("ICE gathering complete for viewer:", data.viewerId);
          }
        };

        // Create offer with all media
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        
        console.log("Sending offer to viewer:", data.viewerId);
        socket.emit("webrtc:offer", {
          viewerSocketId: data.viewerSocketId,
          offer: pc.localDescription!.toJSON(),
        });
      } catch (error) {
        console.error("Error creating WebRTC offer:", error);
      }
    };

    // WebRTC: Handle answer from viewer
    const handleAnswer = async (data: { broadcastId: string; viewerSocketId: string; answer: RTCSessionDescriptionInit }) => {
      if (data.broadcastId !== broadcastId) return;

      try {
        // Find the peer connection by socket ID
        for (const [viewerId, pc] of peerConnectionsRef.current.entries()) {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
          }
        }
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    };

    // WebRTC: Handle ICE candidate from viewer
    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit; senderSocketId: string }) => {
      try {
        // Add ICE candidate to the appropriate peer connection
        for (const pc of peerConnectionsRef.current.values()) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;
          }
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    };

    socket.on("stream:viewer-join", handleViewerJoin);
    socket.on("stream:viewer-leave", handleViewerLeave);
    socket.on("stream:message", handleStreamMessage);
    socket.on("stream:question", handleStreamQuestion);
    socket.on("webrtc:offer-requested", handleOfferRequested);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("stream:viewer-join", handleViewerJoin);
      socket.off("stream:viewer-leave", handleViewerLeave);
      socket.off("stream:message", handleStreamMessage);
      socket.off("stream:question", handleStreamQuestion);
      socket.off("webrtc:offer-requested", handleOfferRequested);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
    };
  }, [socket, isStreaming, broadcastId]);

  // Set local video preview when streaming starts
  useEffect(() => {
    if (isStreaming && streamRef.current && videoRef.current && streamMode === "video") {
      console.log("Setting local video preview in useEffect...");
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()
        .then(() => console.log("Local video preview playing"))
        .catch(err => console.error("Local video preview play error:", err));
    }
  }, [isStreaming, streamMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      // Close all peer connections
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, []);

  // Format duration
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-6 w-6" />
            <div>
              <h2 className="text-xl font-bold">Broadcast Studio</h2>
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-300 animate-pulse" />
                    <span>LIVE</span>
                  </div>
                  <span>•</span>
                  <span>{formatDuration(duration)}</span>
                  <span>•</span>
                  <span>{viewers.length} viewers</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={isStreaming ? endBroadcast : onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main broadcast area */}
          <div className="flex-1 flex flex-col bg-slate-50">
            {!isStreaming ? (
              // Setup screen
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Broadcast Title *
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Morning Huddle, Weekly Update"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description (Optional)
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's this broadcast about?"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Stream Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "video", label: "Video", icon: Video },
                        { value: "audio", label: "Audio", icon: Mic },
                        { value: "text", label: "Text", icon: MessageCircle },
                      ].map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => setStreamMode(mode.value as any)}
                          className={cn(
                            "p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors",
                            streamMode === mode.value
                              ? "border-red-600 bg-red-50 text-red-700"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <mode.icon className="h-5 w-5" />
                          <span className="text-sm font-medium">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={startBroadcast}
                    className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Start Broadcast
                  </Button>
                </div>
              </div>
            ) : (
              // Live broadcast view
              <div className="flex-1 flex flex-col">
                {/* Video preview */}
                {streamMode === "video" && (
                  <div className="flex-1 bg-black flex items-center justify-center relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                      style={{ maxHeight: '100%', maxWidth: '100%' }}
                    />
                    {!videoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <VideoOff className="h-16 w-16 text-slate-400" />
                      </div>
                    )}
                  </div>
                )}

                {/* Controls */}
                <div className="bg-slate-900 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {streamMode === "video" && (
                      <button
                        onClick={toggleVideo}
                        className={cn(
                          "p-3 rounded-lg transition-colors",
                          videoEnabled
                            ? "bg-slate-700 hover:bg-slate-600"
                            : "bg-red-600 hover:bg-red-700"
                        )}
                      >
                        {videoEnabled ? (
                          <Video className="h-5 w-5 text-white" />
                        ) : (
                          <VideoOff className="h-5 w-5 text-white" />
                        )}
                      </button>
                    )}
                    
                    {streamMode !== "text" && (
                      <button
                        onClick={toggleAudio}
                        className={cn(
                          "p-3 rounded-lg transition-colors",
                          audioEnabled
                            ? "bg-slate-700 hover:bg-slate-600"
                            : "bg-red-600 hover:bg-red-700"
                        )}
                      >
                        {audioEnabled ? (
                          <Mic className="h-5 w-5 text-white" />
                        ) : (
                          <MicOff className="h-5 w-5 text-white" />
                        )}
                      </button>
                    )}
                  </div>

                  <Button
                    onClick={endBroadcast}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    End Broadcast
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Viewers/Chat/Questions */}
          {isStreaming && (
            <div className="w-80 border-l border-slate-200 flex flex-col bg-white">
              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                {[
                  { id: "viewers", label: "Viewers", icon: Users, count: viewers.length },
                  { id: "chat", label: "Chat", icon: MessageCircle, count: messages.length },
                  { id: "questions", label: "Q&A", icon: HelpCircle, count: questions.filter(q => !q.isAnswered).length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex-1 p-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                      activeTab === tab.id
                        ? "border-red-600 text-red-600 bg-red-50"
                        : "border-transparent text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                    {tab.count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "viewers" && (
                  <div className="space-y-2">
                    {viewers.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">
                        Waiting for viewers...
                      </p>
                    ) : (
                      viewers.map((viewer) => (
                        <div
                          key={viewer.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
                        >
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="text-sm font-medium flex-1">{viewer.viewerName}</span>
                          {viewer.isMinimized && (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "chat" && (
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No messages yet
                      </p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className="space-y-1">
                          <div className="text-xs font-medium text-slate-700">
                            {msg.senderName}
                          </div>
                          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2">
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "questions" && (
                  <div className="space-y-3">
                    {questions.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No questions yet
                      </p>
                    ) : (
                      questions.map((q) => (
                        <div
                          key={q.id}
                          className={cn(
                            "p-3 rounded-lg border",
                            q.isAnswered
                              ? "bg-green-50 border-green-200"
                              : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <div className="text-xs font-medium text-slate-700 mb-1">
                            {q.askerName}
                          </div>
                          <div className="text-sm text-slate-900 mb-2">
                            {q.question}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>👍 {q.upvotes}</span>
                            {q.isAnswered && (
                              <span className="text-green-600">✓ Answered</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
