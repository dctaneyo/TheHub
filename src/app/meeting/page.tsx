"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Lock, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingRoomLiveKit as MeetingRoom } from "@/components/meeting-room-livekit";
import { SocketProvider } from "@/lib/socket-context";
import { AuthContext } from "@/lib/auth-context";

interface MeetingInfo {
  id: string;
  meetingCode: string;
  title: string;
  hostName: string;
  scheduledAt: string;
  durationMinutes: number;
  hasPassword: boolean;
}

function GuestMeetingWrapper({ meetingId, title, guestName, onLeave }: {
  meetingId: string; title: string; guestName: string; onLeave: () => void;
}) {
  // Provide a mock auth context so useAuth() inside MeetingRoom gets the guest user
  const guestAuth = {
    user: { id: `guest-temp`, userType: "guest" as const, userId: "000000", name: guestName },
    loading: false,
    login: async () => ({ success: false as const, error: "Guest mode" }),
    logout: async () => {},
  };

  return (
    <AuthContext.Provider value={guestAuth}>
      <SocketProvider guestName={guestName} guestMeetingId={meetingId}>
        <MeetingRoom
          meetingId={meetingId}
          title={title}
          isHost={false}
          onLeave={onLeave}
        />
      </SocketProvider>
    </AuthContext.Provider>
  );
}

export default function GuestMeetingPage() {
  const [step, setStep] = useState<"join" | "meeting">("join");
  const [meetingCode, setMeetingCode] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!meetingCode.trim() || !guestName.trim()) {
      setError("Please enter a meeting code and your name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/meetings/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingCode: meetingCode.trim().toUpperCase(),
          password: password.trim(),
          guestName: guestName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join meeting");
        setLoading(false);
        return;
      }

      setMeetingInfo(data.meeting);
      setActiveMeetingId(`scheduled-${data.meeting.meetingCode}`);
      // Go directly to meeting — the MeetingRoom handles the case where
      // the meeting doesn't exist yet (server returns meeting:error)
      // We'll connect to socket and listen for meeting:started to retry
      setStep("meeting");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveMeeting = () => {
    setStep("join");
    setActiveMeetingId(null);
    setMeetingInfo(null);
    setMeetingCode("");
    setPassword("");
  };

  // If in meeting, render the MeetingRoom wrapped with guest providers
  if (step === "meeting" && activeMeetingId && meetingInfo) {
    return (
      <GuestMeetingWrapper
        meetingId={activeMeetingId}
        title={meetingInfo.title}
        guestName={guestName}
        onLeave={handleLeaveMeeting}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === "join" && (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <Video className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold">Join a Meeting</h1>
                <p className="text-sm text-red-100 mt-1">Enter the meeting code to join</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Meeting Code</label>
                  <Input
                    value={meetingCode}
                    onChange={(e) => { setMeetingCode(e.target.value.toUpperCase()); setError(""); }}
                    placeholder="e.g. ABC123"
                    className="text-center text-lg font-mono tracking-widest uppercase"
                    maxLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={guestName}
                      onChange={(e) => { setGuestName(e.target.value); setError(""); }}
                      placeholder="Enter your name"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Password <span className="text-slate-400 font-normal">(if required)</span>
                    </div>
                  </label>
                  <Input
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Enter meeting password"
                    type="password"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <Button
                  onClick={handleJoin}
                  disabled={loading || !meetingCode.trim() || !guestName.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-semibold rounded-xl"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>Join Meeting <ArrowRight className="h-5 w-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-4">The Hub &bull; Video Meeting Platform</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
