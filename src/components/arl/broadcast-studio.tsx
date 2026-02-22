"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Video, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/lib/socket-context";
import { MeetingRoom } from "@/components/meeting-room";

interface BroadcastStudioProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialMeetingCode?: string;
}

export function BroadcastStudio({ isOpen, onClose, initialTitle, initialMeetingCode }: BroadcastStudioProps) {
  const [title, setTitle] = useState(initialTitle || "");

  // Sync initialTitle when it changes (e.g. starting from scheduled meeting)
  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
  }, [initialTitle]);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [inMeeting, setInMeeting] = useState(false);

  const { socket } = useSocket();

  const startMeeting = () => {
    if (!title.trim()) {
      alert("Please enter a meeting title");
      return;
    }

    const id = initialMeetingCode
      ? `scheduled-${initialMeetingCode}`
      : `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMeetingId(id);

    // Create meeting on server
    socket?.emit("meeting:create", { meetingId: id, title: title.trim() });

    // Enter the meeting room
    setInMeeting(true);
  };

  const handleLeaveMeeting = () => {
    setInMeeting(false);
    setMeetingId(null);
    setTitle("");
    onClose();
  };

  if (!isOpen) return null;

  // If in meeting, show the MeetingRoom
  if (inMeeting && meetingId) {
    return (
      <MeetingRoom
        meetingId={meetingId}
        title={title}
        isHost={true}
        onLeave={handleLeaveMeeting}
      />
    );
  }

  // Setup screen
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-bold">Start a Meeting</h2>
              <p className="text-sm text-red-100">Create a live video meeting with restaurants and ARLs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Meeting Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Team Huddle, Training Session..."
              className="text-base"
              onKeyDown={(e) => { if (e.key === "Enter") startMeeting(); }}
            />
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Meeting Features</h3>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                ARLs join with video &amp; audio (camera + mic)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Restaurants join with audio only (mic, no camera)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Screen sharing, chat, Q&amp;A, reactions
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                Raise hand &amp; host controls for speaking
              </li>
            </ul>
          </div>

          <Button
            onClick={startMeeting}
            disabled={!title.trim()}
            className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-semibold rounded-xl"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Meeting
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
