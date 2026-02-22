"use client";

import { useState, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Lock, User, ArrowRight, Loader2, AlertCircle, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingRoom } from "@/components/meeting-room";
import { SocketProvider } from "@/lib/socket-context";

// Guest auth context — provides a mock user for MeetingRoom's useAuth() calls
const GuestAuthContext = createContext<any>(null);
function GuestAuthProvider({ guestName, children }: { guestName: string; children: React.ReactNode }) {
  const value = {
    user: { id: `guest-temp`, userType: "guest" as const, userId: "000000", name: guestName },
    loading: false,
    login: async () => ({ success: false, error: "Guest mode" }),
    logout: async () => {},
  };
  return <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>;
}

// Patch: override the AuthContext so useAuth() inside MeetingRoom picks up the guest user
// We do this by wrapping with the real AuthProvider module's context
import { AuthProvider } from "@/lib/auth-context";

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
  return (
    <SocketProvider guestName={guestName} guestMeetingId={meetingId}>
      <MeetingRoom
        meetingId={meetingId}
        title={title}
        isHost={false}
        onLeave={onLeave}
      />
    </SocketProvider>
  );
}

export default function GuestMeetingPage() {
  const [step, setStep] = useState<"join" | "waiting" | "meeting">("join");
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
      setStep("waiting");
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
      <AuthProvider>
        <GuestMeetingWrapper
          meetingId={activeMeetingId}
          title={meetingInfo.title}
          guestName={guestName}
          onLeave={handleLeaveMeeting}
        />
      </AuthProvider>
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

        {step === "waiting" && meetingInfo && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold">{meetingInfo.title}</h1>
                <p className="text-sm text-blue-100 mt-1">Hosted by {meetingInfo.hostName}</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {new Date(meetingInfo.scheduledAt).toLocaleDateString(undefined, {
                        weekday: "long", month: "long", day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(meetingInfo.scheduledAt).toLocaleTimeString(undefined, {
                        hour: "numeric", minute: "2-digit",
                      })}
                      {" "}&bull; {meetingInfo.durationMinutes} min
                    </p>
                  </div>
                </div>

                <div className="text-center py-6">
                  <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 rounded-full px-4 py-2 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for host to start the meeting...
                  </div>
                  <p className="text-xs text-slate-400 mt-3">
                    You&apos;ll be connected automatically when the meeting begins
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setStep("meeting")}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white h-11 font-semibold rounded-xl"
                  >
                    Enter Meeting Room
                  </Button>
                  <Button onClick={handleLeaveMeeting} variant="outline" className="h-11 rounded-xl">
                    Leave
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
