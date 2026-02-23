"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Video, Lock, User, ArrowRight, Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";
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
  isLive?: boolean;
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

function GuestMeetingPageWithParams() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"join" | "waiting" | "waiting-for-host" | "meeting">("join");
  const [meetingCode, setMeetingCode] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  // Read URL parameters on component mount
  const isOneClickJoin = !!searchParams?.get("code");
  useEffect(() => {
    const code = searchParams?.get("code");
    const pwd = searchParams?.get("password");
    
    if (code) {
      setMeetingCode(code.toUpperCase());
    }
    if (pwd) {
      setPassword(pwd);
    }
  }, [searchParams]);

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

      // Check if guest is too early for a scheduled meeting
      const scheduledTime = new Date(data.meeting.scheduledAt).getTime();
      const now = Date.now();
      const minutesUntilMeeting = (scheduledTime - now) / 60000;

      // Only connect to LiveKit if meeting is already live (saves LiveKit minutes)
      if (data.meeting.isLive) {
        setStep("meeting");
      } else if (minutesUntilMeeting > 30) {
        // Way too early — show countdown timer
        setStep("waiting");
      } else {
        // Within 30 min but host hasn't started — wait without LiveKit
        setStep("waiting-for-host");
      }
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

  // Waiting room: poll to check if meeting has started, countdown timer
  const [countdown, setCountdown] = useState("");
  const [minutesEarly, setMinutesEarly] = useState(0);

  useEffect(() => {
    if (step !== "waiting" || !meetingInfo) return;

    // Countdown tick every second
    const tick = () => {
      const scheduledTime = new Date(meetingInfo.scheduledAt).getTime();
      const now = Date.now();
      const diff = scheduledTime - now;
      const minsEarly = diff / 60000;
      setMinutesEarly(minsEarly);

      if (diff <= 30 * 60000) {
        // Within 30 min — move to waiting-for-host (still no LiveKit until host starts)
        setStep("waiting-for-host");
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (hours > 0) {
        setCountdown(`${hours}h ${mins}m ${secs}s`);
      } else {
        setCountdown(`${mins}m ${secs}s`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [step, meetingInfo]);

  // Poll every 10s to check if meeting has gone live (shared by both waiting steps)
  useEffect(() => {
    if ((step !== "waiting" && step !== "waiting-for-host") || !meetingInfo) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/meetings/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingCode: meetingInfo.meetingCode,
            password: password,
            guestName: guestName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.meeting?.isLive) {
            setStep("meeting");
          }
        }
      } catch { /* ignore */ }
    };

    // Poll immediately on entering waiting-for-host, then every 10s
    if (step === "waiting-for-host") poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [step, meetingInfo, password, guestName]);

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
        {step === "waiting" && meetingInfo && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold">Meeting Hasn&apos;t Started Yet</h1>
                <p className="text-sm text-amber-100 mt-1">{meetingInfo.title}</p>
              </div>

              <div className="p-6 space-y-5">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Meeting starts in</p>
                  <p className="text-3xl font-bold font-mono text-slate-800 tracking-wide">{countdown}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Scheduled for {new Date(meetingInfo.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>You&apos;ll be automatically connected when the meeting is about to start.</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Checking if meeting has started...
                </div>

                {/* Join Anyway — only if 30-60 min early, goes to waiting-for-host (no LiveKit yet) */}
                {minutesEarly <= 60 && (
                  <Button
                    onClick={() => setStep("waiting-for-host")}
                    variant="outline"
                    className="w-full h-11 text-sm font-semibold rounded-xl border-slate-300"
                  >
                    Join Anyway <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}

                <button
                  onClick={() => { setStep("join"); setMeetingInfo(null); setActiveMeetingId(null); }}
                  className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  &larr; Back
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-4">The Hub &bull; Video Meeting Platform</p>
          </motion.div>
        )}

        {step === "waiting-for-host" && meetingInfo && (
          <motion.div
            key="waiting-for-host"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <Video className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold">Waiting for Host</h1>
                <p className="text-sm text-blue-100 mt-1">{meetingInfo.title}</p>
              </div>

              <div className="p-6 space-y-5">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">The host hasn&apos;t started the meeting yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    You&apos;ll be connected automatically once it begins
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Checking every 10 seconds...
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Scheduled for</p>
                  <p className="text-sm font-medium text-slate-600">
                    {new Date(meetingInfo.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>

                <button
                  onClick={() => { setStep("join"); setMeetingInfo(null); setActiveMeetingId(null); }}
                  className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  &larr; Back
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-4">The Hub &bull; Video Meeting Platform</p>
          </motion.div>
        )}

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
                <h1 className="text-xl font-bold">
                  {isOneClickJoin ? "You're Invited!" : "Join a Meeting"}
                </h1>
                <p className="text-sm text-red-100 mt-1">
                  {isOneClickJoin ? "Enter your name to join the meeting" : "Enter the meeting code to join"}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {!isOneClickJoin && (
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
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={guestName}
                      onChange={(e) => { setGuestName(e.target.value); setError(""); }}
                      placeholder="Enter your name"
                      className="pl-10"
                      autoFocus={isOneClickJoin}
                    />
                  </div>
                </div>

                {!isOneClickJoin && (
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
                )}

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

// Main export with Suspense boundary
export default function GuestMeetingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading meeting...</p>
        </div>
      </div>
    }>
      <GuestMeetingPageWithParams />
    </Suspense>
  );
}
