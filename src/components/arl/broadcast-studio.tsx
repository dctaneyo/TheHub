"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Video, Play, X, Copy, Check, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/lib/socket-context";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";

function generateMeetingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

interface BroadcastStudioProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialMeetingCode?: string;
}

export function BroadcastStudio({ isOpen, onClose, initialTitle, initialMeetingCode }: BroadcastStudioProps) {
  const [title, setTitle] = useState(initialTitle || "");
  const [password, setPassword] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Generate a stable meeting code for this session
  const generatedCode = useMemo(() => generateMeetingCode(), []);
  const meetingCode = initialMeetingCode || generatedCode;

  // Sync initialTitle when it changes
  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
  }, [initialTitle]);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [inMeeting, setInMeeting] = useState(false);

  const { socket } = useSocket();

  const copyCode = () => {
    navigator.clipboard.writeText(meetingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const startMeeting = () => {
    if (!title.trim()) {
      alert("Please enter a meeting title");
      return;
    }

    const id = `scheduled-${meetingCode}`;
    setMeetingId(id);

    // Create meeting on server (include password if set)
    socket?.emit("meeting:create", {
      meetingId: id,
      title: title.trim(),
      password: password.trim() || undefined,
      meetingCode,
    });

    // Enter the meeting room
    setInMeeting(true);
  };

  const handleLeaveMeeting = () => {
    setInMeeting(false);
    setMeetingId(null);
    setTitle("");
    setPassword("");
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
              <p className="text-sm text-red-100">Create a live video meeting</p>
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

          {/* Meeting Code */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-slate-700">Meeting Code</label>
              <span className="text-[10px] text-slate-400 font-medium">Share with guests to join</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-center">
                <span className="font-mono text-xl font-bold text-red-600 tracking-[0.3em]">{meetingCode}</span>
              </div>
              <button onClick={copyCode}
                className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700">
                {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Password (optional) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <div className="flex items-center gap-1.5">
                {password.trim() ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Globe className="h-3.5 w-3.5 text-green-500" />}
                Password <span className="text-slate-400 font-normal">(optional)</span>
              </div>
            </label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty for open access"
              type="password"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {password.trim() ? "Guests will need this password to join" : "Anyone with the meeting code can join"}
            </p>
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
