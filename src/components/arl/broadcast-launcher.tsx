"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Play, X, Users } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/lib/socket-context";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";

function generateBroadcastCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

interface BroadcastLauncherProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BroadcastLauncher({ isOpen, onClose }: BroadcastLauncherProps) {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [inBroadcast, setInBroadcast] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const { socket } = useSocket();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setTitleError(false);
    }
  }, [isOpen]);

  // Listen for viewer count updates
  useEffect(() => {
    if (!socket || !broadcastId) return;
    const handler = (data: { broadcastId: string; viewerCount: number }) => {
      if (data.broadcastId === broadcastId) setViewerCount(data.viewerCount);
    };
    socket.on("broadcast:viewer-count", handler);
    return () => { socket.off("broadcast:viewer-count", handler); };
  }, [socket, broadcastId]);

  const goLive = () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);

    const code = generateBroadcastCode();
    const id = `broadcast-${code}`;
    setMeetingId(id);

    // Create the underlying LiveKit meeting
    socket?.emit("meeting:create", {
      meetingId: id,
      title: title.trim(),
      meetingCode: code,
    });

    // Start the broadcast — pushes to all online locations
    socket?.emit("broadcast:start", {
      title: title.trim(),
      meetingId: id,
      meetingCode: code,
    });

    // Capture the broadcastId from the server response
    const handleStarted = (data: { broadcastId: string; meetingId: string }) => {
      if (data.meetingId === id) {
        setBroadcastId(data.broadcastId);
        socket?.off("broadcast:started", handleStarted);
      }
    };
    socket?.on("broadcast:started", handleStarted);

    setInBroadcast(true);
  };

  const endBroadcast = (didEndMeeting?: boolean) => {
    if (broadcastId) {
      socket?.emit("broadcast:end", { broadcastId });
    }
    setInBroadcast(false);
    setMeetingId(null);
    setBroadcastId(null);
    setViewerCount(0);
    setTitle("");
    onClose();
  };

  if (!isOpen) return null;

  // In broadcast — show the MeetingRoom with a viewer count overlay
  if (inBroadcast && meetingId) {
    return (
      <>
        <MeetingRoom
          meetingId={meetingId}
          title={title}
          isHost={true}
          onLeave={(didEnd) => endBroadcast(didEnd)}
        />
        {/* Viewer count badge */}
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold uppercase">Live</span>
          <span className="text-xs text-white/70">·</span>
          <Users className="h-3.5 w-3.5 text-white/70" />
          <span className="text-xs font-semibold">{viewerCount}</span>
        </div>
      </>
    );
  }

  // Setup screen
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="h-6 w-6" />
              <div>
                <h2 className="text-lg font-bold">Go Live</h2>
                <p className="text-sm text-red-100">Broadcast to all online locations</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Broadcast Title</label>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
                placeholder="e.g. Morning Huddle, Important Update..."
                className={`text-base ${titleError ? "border-red-500 ring-red-500/20 ring-2" : ""}`}
                onKeyDown={(e) => { if (e.key === "Enter") goLive(); }}
                autoFocus
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                This will automatically open on all online restaurant screens. Locations that come online during the broadcast will also see it immediately.
              </p>
            </div>

            <Button
              onClick={goLive}
              disabled={!title.trim()}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white h-12 text-base font-semibold rounded-xl"
            >
              <Radio className="h-5 w-5 mr-2" />
              Go Live
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
