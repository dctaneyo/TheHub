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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";

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
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const joinTimeRef = useRef<number>(Date.now());
  
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

    const handleStreamEnded = (data: { broadcastId: string }) => {
      if (data.broadcastId === broadcastId) {
        alert("This broadcast has ended");
        onClose();
      }
    };

    socket.on("stream:message", handleStreamMessage);
    socket.on("stream:reaction", handleStreamReaction);
    socket.on("stream:ended", handleStreamEnded);

    return () => {
      socket.off("stream:message", handleStreamMessage);
      socket.off("stream:reaction", handleStreamReaction);
      socket.off("stream:ended", handleStreamEnded);
    };
  }, [socket, broadcastId, onClose]);

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
            onClick={() => setShowChat(!showChat)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showChat ? "bg-white/20" : "hover:bg-white/10"
            )}
          >
            <MessageCircle className="h-5 w-5" />
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
            className="max-h-full max-w-full"
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
      </div>
    </div>
  );
}
