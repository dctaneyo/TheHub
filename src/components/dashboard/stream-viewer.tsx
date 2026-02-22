"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Minimize2, 
  Maximize2,
  Volume2,
  VolumeX,
  MessageCircle,
  ThumbsUp,
  Heart,
  Smile,
  Zap,
  Send,
  HelpCircle,
  CheckCircle,
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

interface StreamViewerProps {
  broadcastId: string;
  arlName: string;
  title: string;
  onClose: () => void;
}

interface StreamMessage {
  id: string;
  senderName: string;
  content: string;
  timestamp: number;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏", "💯"];

export function StreamViewer({ broadcastId, arlName, title, onClose }: StreamViewerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [questions, setQuestions] = useState<Array<{ id: string; askerName: string; question: string; upvotes: number; isAnswered: boolean }>>([]);
  const [newQuestion, setNewQuestion] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const joinTimeRef = useRef<number>(Date.now());
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const arlSocketIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  
  const { socket } = useSocket();


  // Join broadcast as viewer
  useEffect(() => {
    const joinBroadcast = async () => {
      try {
        const res = await fetch("/api/broadcasts/viewers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ broadcastId }),
        });

        if (res.ok) {
          const data = await res.json();
          setViewerId(data.viewerId);
          
          // Join broadcast room via socket
          if (socket) {
            socket.emit("broadcast:join", { broadcastId, viewerId: data.viewerId });
            
            // Request WebRTC offer from broadcaster
            socket.emit("webrtc:request-offer", { 
              broadcastId, 
              viewerId: data.viewerId 
            });
          }
        }
      } catch (error) {
        console.error("Failed to join broadcast:", error);
      }
    };

    joinBroadcast();
  }, [broadcastId, socket]);

  // Leave broadcast on unmount
  useEffect(() => {
    return () => {
      if (viewerId && socket) {
        const watchDuration = Math.floor((Date.now() - joinTimeRef.current) / 1000);
        
        // Update viewer status
        fetch("/api/broadcasts/viewers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewerId,
            broadcastId,
            leftAt: new Date().toISOString(),
            watchDuration,
          }),
        });

        socket.emit("broadcast:leave", { broadcastId, viewerId });
      }
    };
  }, [viewerId, broadcastId, socket]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleStreamMessage = (data: StreamMessage) => {
      setMessages(prev => [...prev, data]);
    };

    const handleStreamReaction = (data: { emoji: string; viewerName: string }) => {
      // Add floating reaction animation
      const id = `${Date.now()}-${Math.random()}`;
      const x = Math.random() * 80 + 10; // Random position 10-90%
      setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, x }]);
      
      // Remove after animation
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    };

    const handleStreamQuestion = (data: { id: string; askerName: string; question: string; upvotes: number; isAnswered: boolean }) => {
      setQuestions(prev => [...prev, data]);
    };

    const handleQuestionAnswered = (data: { questionId: string }) => {
      setQuestions(prev => prev.map(q => q.id === data.questionId ? { ...q, isAnswered: true } : q));
    };

    const handleQuestionUpvoted = (data: { questionId: string }) => {
      setQuestions(prev => prev.map(q => q.id === data.questionId ? { ...q, upvotes: q.upvotes + 1 } : q));
    };

    const handleStreamEnded = (data: { broadcastId: string }) => {
      if (data.broadcastId === broadcastId) {
        alert("This broadcast has ended");
        onCloseRef.current();
      }
    };

    // WebRTC: Handle offer from broadcaster
    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; arlSocketId: string }) => {
      try {
        console.log("Received offer from ARL socket:", data.arlSocketId);
        arlSocketIdRef.current = data.arlSocketId;
        
        // Create peer connection
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          console.log("Viewer peer connection state:", pc.connectionState);
        };
        
        pc.oniceconnectionstatechange = () => {
          console.log("Viewer ICE connection state:", pc.iceConnectionState);
        };

        // Handle incoming video stream
        pc.ontrack = (event) => {
          console.log("WebRTC track received:", event.track.kind, event.track.label);
          console.log("Track enabled:", event.track.enabled);
          console.log("Track readyState:", event.track.readyState);
          console.log("Track muted:", event.track.muted);
          
          if (event.track.kind === "video") {
            const settings = event.track.getSettings();
            console.log("Video track settings:", settings);
          }
          
          // Only set srcObject once when we receive the first track
          if (videoRef.current && event.streams[0] && !videoRef.current.srcObject) {
            console.log("Setting video srcObject from WebRTC stream...");
            videoRef.current.srcObject = event.streams[0];
            console.log("Video element srcObject set with", event.streams[0].getTracks().length, "tracks");
            
            // Log video element properties
            setTimeout(() => {
              if (videoRef.current) {
                console.log("Video element videoWidth:", videoRef.current.videoWidth);
                console.log("Video element videoHeight:", videoRef.current.videoHeight);
                console.log("Video element paused:", videoRef.current.paused);
                console.log("Video element readyState:", videoRef.current.readyState);
              }
            }, 1000);
            
            videoRef.current.play()
              .then(() => console.log("Video playing successfully from WebRTC stream"))
              .catch(err => console.error("Video play error:", err));
          } else {
            console.log("Track added to existing stream, total tracks:", event.streams[0].getTracks().length);
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit("webrtc:ice-candidate", {
              targetSocketId: arlSocketIdRef.current,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        // Set remote description (offer)
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Add any pending ICE candidates that arrived before the offer
        console.log("Processing", pendingIceCandidatesRef.current.length, "pending ICE candidates");
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding pending ICE candidate:", err);
          }
        }
        pendingIceCandidatesRef.current = [];

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc:answer", {
          broadcastId,
          answer: pc.localDescription!.toJSON(),
        });
      } catch (error) {
        console.error("Error handling WebRTC offer:", error);
      }
    };

    // WebRTC: Handle ICE candidate from broadcaster
    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit; senderSocketId: string }) => {
      try {
        arlSocketIdRef.current = data.senderSocketId;
        
        if (peerConnectionRef.current) {
          if (peerConnectionRef.current.remoteDescription) {
            // Remote description is set, add candidate immediately
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log("Added ICE candidate from ARL");
          } else {
            // Queue candidate until remote description is set
            console.log("Queuing ICE candidate (no remote description yet)");
            pendingIceCandidatesRef.current.push(data.candidate);
          }
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    };

    socket.on("stream:message", handleStreamMessage);
    socket.on("stream:reaction", handleStreamReaction);
    socket.on("stream:ended", handleStreamEnded);
    socket.on("stream:question", handleStreamQuestion);
    socket.on("stream:question-answered", handleQuestionAnswered);
    socket.on("stream:question-upvoted", handleQuestionUpvoted);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("stream:message", handleStreamMessage);
      socket.off("stream:reaction", handleStreamReaction);
      socket.off("stream:ended", handleStreamEnded);
      socket.off("stream:question", handleStreamQuestion);
      socket.off("stream:question-answered", handleQuestionAnswered);
      socket.off("stream:question-upvoted", handleQuestionUpvoted);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, broadcastId]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send reaction
  const sendReaction = (emoji: string) => {
    if (!socket || !viewerId) return;
    
    socket.emit("broadcast:reaction", {
      broadcastId,
      viewerId,
      emoji,
      timestamp: Math.floor((Date.now() - joinTimeRef.current) / 1000),
    });
  };

  // Send message
  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !viewerId) return;

    socket.emit("broadcast:message", {
      broadcastId,
      viewerId,
      content: newMessage,
      timestamp: Math.floor((Date.now() - joinTimeRef.current) / 1000),
    });

    setNewMessage("");
  };

  // Send question
  const sendQuestion = () => {
    if (!newQuestion.trim() || !socket) return;
    socket.emit("broadcast:question", {
      broadcastId,
      question: newQuestion.trim(),
    });
    setNewQuestion("");
  };

  // Upvote question
  const upvoteQuestion = (questionId: string) => {
    if (!socket) return;
    socket.emit("broadcast:upvote-question", { broadcastId, questionId });
  };

  // Handle minimize
  const handleMinimize = async () => {
    setIsMinimized(true);
    if (viewerId) {
      await fetch("/api/broadcasts/viewers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerId, isMinimized: true }),
      });
    }
  };

  // Handle maximize
  const handleMaximize = async () => {
    setIsMinimized(false);
    if (viewerId) {
      await fetch("/api/broadcasts/viewers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerId, isMinimized: false }),
      });
    }
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={handleMaximize}
          className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl shadow-2xl p-4 hover:from-red-700 hover:to-red-800 transition-all flex items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-300 animate-pulse" />
            <span className="font-bold">LIVE</span>
          </div>
          <span className="text-sm">{arlName}</span>
          <Maximize2 className="h-4 w-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-300 animate-pulse" />
            <span className="font-bold text-lg">LIVE</span>
          </div>
          <div>
            <h2 className="font-bold">{title}</h2>
            <p className="text-sm text-red-100">{arlName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowChat(!showChat); if (!showChat) setShowQA(false); }}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showChat ? "bg-white/20" : "hover:bg-white/10"
            )}
            title="Chat"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => { setShowQA(!showQA); if (!showQA) setShowChat(false); }}
            className={cn(
              "p-2 rounded-lg transition-colors relative",
              showQA ? "bg-white/20" : "hover:bg-white/10"
            )}
            title="Q&A"
          >
            <HelpCircle className="h-5 w-5" />
            {questions.filter(q => !q.isAnswered).length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-400 text-[10px] font-bold text-black flex items-center justify-center">
                {questions.filter(q => !q.isAnswered).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            onClick={handleMinimize}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video area */}
        <div className="flex-1 flex items-center justify-center bg-black relative">
          <video
            ref={videoRef}
            autoPlay
            muted={isMuted}
            playsInline
            className="w-full h-full object-contain"
            style={{ maxHeight: '100%', maxWidth: '100%' }}
          />
          
          {/* Floating reactions */}
          <AnimatePresence>
            {floatingReactions.map((reaction) => (
              <motion.div
                key={reaction.id}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -200, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: "easeOut" }}
                className="absolute bottom-20 text-4xl pointer-events-none"
                style={{ left: `${reaction.x}%` }}
              >
                {reaction.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Reaction buttons */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform p-2 hover:bg-white/10 rounded-full"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Chat sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 bg-slate-900 flex flex-col border-l border-slate-700"
            >
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-white font-bold">Live Chat</h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">
                    No messages yet. Be the first to chat!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="text-xs font-medium text-slate-300">
                        {msg.senderName}
                      </div>
                      <div className="text-sm text-white bg-slate-800 rounded-lg p-2">
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="p-3 border-t border-slate-700">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    size="icon"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Q&A sidebar */}
        <AnimatePresence>
          {showQA && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 bg-slate-900 flex flex-col border-l border-slate-700"
            >
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-white font-bold">Q&A</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ask questions to the broadcaster</p>
              </div>

              {/* Questions list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {questions.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">
                    No questions yet. Ask the first one!
                  </p>
                ) : (
                  questions.map((q) => (
                    <div
                      key={q.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        q.isAnswered
                          ? "bg-green-900/30 border-green-700"
                          : "bg-slate-800 border-slate-700"
                      )}
                    >
                      <div className="text-xs font-medium text-slate-300 mb-1">
                        {q.askerName}
                      </div>
                      <div className="text-sm text-white mb-2">
                        {q.question}
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => upvoteQuestion(q.id)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400 transition-colors"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span>{q.upvotes}</span>
                        </button>
                        {q.isAnswered && (
                          <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                            <CheckCircle className="h-3 w-3" />
                            Answered
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Question input */}
              <div className="p-3 border-t border-slate-700">
                <div className="flex gap-2">
                  <Input
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendQuestion();
                      }
                    }}
                    placeholder="Ask a question..."
                    className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
                  />
                  <Button
                    onClick={sendQuestion}
                    disabled={!newQuestion.trim()}
                    size="icon"
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
