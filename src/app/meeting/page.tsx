"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Video, Lock, User, ArrowRight, Loader2, AlertCircle, Clock, CheckCircle2, LogIn, UserPlus, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";
import { SocketProvider, useSocket } from "@/lib/socket-context";
import { AuthContext } from "@/lib/auth-context";

interface MeetingInfo {
  id: string;
  meetingCode: string;
  title: string;
  hostName: string;
  hostId: string;
  scheduledAt: string;
  durationMinutes: number;
  hasPassword: boolean;
  isLive?: boolean;
}

function GuestMeetingWrapper({ meetingId, title, guestName, authenticatedUser, hostId, onLeave, shouldStartMeeting }: {
  meetingId: string; title: string; guestName: string; authenticatedUser?: any; hostId?: string; onLeave: () => void; shouldStartMeeting?: boolean;
}) {
  // Determine if the authenticated user is the host
  const isHost = authenticatedUser && hostId && authenticatedUser.id === hostId;

  // If authenticated user exists, use their context; otherwise use guest context
  const authContext = authenticatedUser ? {
    user: authenticatedUser,
    loading: false,
    login: async () => ({ success: false as const, error: "Already logged in" }),
    logout: async () => {},
  } : {
    user: { id: `guest-temp`, userType: "guest" as const, userId: "000000", name: guestName },
    loading: false,
    login: async () => ({ success: false as const, error: "Guest mode" }),
    logout: async () => {},
  };

  return (
    <AuthContext.Provider value={authContext}>
      <SocketProvider guestName={authenticatedUser ? undefined : guestName} guestMeetingId={authenticatedUser ? undefined : meetingId}>
        <MeetingRoom
          meetingId={meetingId}
          title={title}
          isHost={isHost}
          onLeave={onLeave}
          shouldStartMeeting={shouldStartMeeting}
        />
      </SocketProvider>
    </AuthContext.Provider>
  );
}

// Lightweight listener — connects to Socket.io, listens for meeting:started, no LiveKit
function WaitingRoomListener({ meetingId, onMeetingStarted }: { meetingId: string; onMeetingStarted: () => void }) {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { meetingId: string }) => {
      if (data.meetingId === meetingId) {
        onMeetingStarted();
      }
    };
    socket.on("meeting:started", handler);
    return () => { socket.off("meeting:started", handler); };
  }, [socket, meetingId, onMeetingStarted]);
  return null; // renders nothing — just listens
}

function GuestMeetingPageWithParams() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"enter-code" | "waiting" | "waiting-for-host" | "meeting" | "meeting-ended">("enter-code");
  const [meetingCode, setMeetingCode] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null); // For restaurant/ARL login
  const [isHostStartingMeeting, setIsHostStartingMeeting] = useState(false); // Track if host is starting meeting
  
  // Auth choice state
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [pinPadStep, setPinPadStep] = useState<"userId" | "pin">("userId");
  
  // Hidden keyboard input ref
  const keyboardInputRef = useRef<HTMLInputElement>(null);

  // Read URL parameters on component mount and fetch meeting info for one-click join
  const isOneClickJoin = !!searchParams?.get("code");
  useEffect(() => {
    const code = searchParams?.get("code");
    const pwd = searchParams?.get("password");
    
    if (code) {
      setMeetingCode(code.toUpperCase());
      
      // Fetch meeting info to display title on one-click join
      if (pwd) {
        setPassword(pwd);
        // Fetch meeting details
        fetch("/api/meetings/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingCode: code.toUpperCase(),
            password: pwd,
            guestName: "temp", // Temporary name just to validate
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.meeting) {
              setMeetingInfo(data.meeting);
            }
          })
          .catch(() => {});
      }
    }
    if (pwd && !code) {
      setPassword(pwd);
    }
  }, [searchParams]);

  // Validate meeting and route to waiting/meeting
  const validateAndJoinMeeting = async (userName: string, userObj?: any) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/meetings/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingCode: meetingCode.trim().toUpperCase(),
          password: password.trim(),
          guestName: userName,
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

      // Check if authenticated user is the host (use passed userObj to avoid stale state)
      const authUser = userObj || authenticatedUser;
      const isHost = authUser && data.meeting.hostId && authUser.id === data.meeting.hostId;

      // If user is the host, start the meeting immediately
      if (isHost) {
        setIsHostStartingMeeting(true); // Flag that host is starting the meeting
        setStep("meeting");
        return;
      }

      // For non-hosts, check if too early for scheduled meeting
      const scheduledTime = new Date(data.meeting.scheduledAt).getTime();
      const now = Date.now();
      const minutesUntilMeeting = (scheduledTime - now) / 60000;

      // Only connect to LiveKit if meeting is already live
      if (data.meeting.isLive) {
        setStep("meeting");
      } else if (minutesUntilMeeting > 30) {
        setStep("waiting");
      } else {
        setStep("waiting-for-host");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Guest join handler
  const handleGuestJoin = async () => {
    if (!meetingCode.trim()) {
      setError("Please enter a meeting code");
      return;
    }
    if (!guestName.trim()) {
      setError("Please enter your name");
      return;
    }
    await validateAndJoinMeeting(guestName.trim());
  };

  // PinPad digit handler with auto-validation
  const handlePinPadDigit = async (digit: string) => {
    setError("");
    if (pinPadStep === "userId") {
      if (userId.length < 4) {
        const newVal = userId + digit;
        setUserId(newVal);
        
        // Auto-validate and advance when 4 digits entered
        if (newVal.length === 4) {
          setLoading(true);
          try {
            const res = await fetch("/api/auth/validate-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: newVal }),
            });
            const data = await res.json();
            if (res.ok && data.found) {
              setError("");
              setPinPadStep("pin");
            } else {
              setError(data.error || "User ID not found");
              setUserId("");
            }
          } catch {
            setError("Connection error. Please try again.");
            setUserId("");
          }
          setLoading(false);
        }
      }
    } else {
      if (pin.length < 4) {
        const newVal = pin + digit;
        setPin(newVal);
        
        // Auto-login when 4 digits entered
        if (newVal.length === 4) {
          setLoading(true);
          setError("");
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, pin: newVal }),
            });

            const data = await res.json();

            if (!res.ok) {
              setError(data.error || "Invalid credentials");
              setPin("");
              setLoading(false);
              return;
            }

            setAuthenticatedUser(data.user);
            await validateAndJoinMeeting(data.user.name, data.user);
          } catch {
            setError("Authentication failed. Please try again.");
            setPin("");
            setLoading(false);
          }
        }
      }
    }
  };

  // PinPad delete handler
  const handlePinPadDelete = () => {
    if (pinPadStep === "userId") {
      setUserId(userId.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
  };

  // PinPad back handler
  const handlePinPadBack = () => {
    if (pinPadStep === "pin") {
      setPinPadStep("userId");
      setPin("");
      setError("");
    } else {
      setShowPinPad(false);
      setUserId("");
      setPin("");
      setPinPadStep("userId");
      setError("");
    }
  };

  const handleLeaveMeeting = (didEndMeeting?: boolean) => {
    if (didEndMeeting) {
      setStep("meeting-ended");
    } else {
      setStep("enter-code");
      setActiveMeetingId(null);
      setMeetingInfo(null);
      setMeetingCode("");
      setPassword("");
    }
  };

  // Keyboard support for PinPad (hidden input field)
  useEffect(() => {
    if (!showPinPad) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if keyboard input is focused
      if (document.activeElement !== keyboardInputRef.current) return;
      
      const key = e.key;
      
      if (key >= '0' && key <= '9') {
        handlePinPadDigit(key);
      } else if (key === 'Backspace' || key === 'Delete') {
        handlePinPadDelete();
      } else if (key === 'Enter') {
        // Could trigger continue/login if ready
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPinPad, pinPadStep, userId, pin]);

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

  // Stable callback for the Socket.io listener
  const handleMeetingStarted = useCallback(() => {
    setStep("meeting");
  }, []);

  // Fallback poll every 60s in case the socket event is missed
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

    // One immediate check on entering waiting-for-host
    if (step === "waiting-for-host") poll();
    // Infrequent fallback — primary detection is via Socket.io real-time event
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [step, meetingInfo, password, guestName]);

  // If in meeting, render the MeetingRoom wrapped with guest or authenticated user providers
  if (step === "meeting" && activeMeetingId && meetingInfo) {
    return (
      <GuestMeetingWrapper
        meetingId={activeMeetingId}
        title={meetingInfo.title}
        guestName={authenticatedUser ? authenticatedUser.name : guestName}
        authenticatedUser={authenticatedUser}
        hostId={meetingInfo.hostId}
        onLeave={handleLeaveMeeting}
        shouldStartMeeting={isHostStartingMeeting}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === "waiting" && meetingInfo && activeMeetingId && (
          <SocketProvider guestName={guestName} guestMeetingId={activeMeetingId}>
            <WaitingRoomListener meetingId={activeMeetingId} onMeetingStarted={handleMeetingStarted} />
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
                    <p className="text-lg font-semibold text-slate-700 mb-3">Welcome, {authenticatedUser ? authenticatedUser.name : guestName}!</p>
                    <p className="text-sm text-slate-500 mb-1">Meeting starts in</p>
                    <p className="text-3xl font-bold font-mono text-slate-800 tracking-wide">{countdown}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Scheduled for {new Date(meetingInfo.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>You&apos;ll be automatically connected when the host starts the meeting.</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    Listening for host...
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
                    onClick={() => { setStep("enter-code"); setMeetingInfo(null); setActiveMeetingId(null); }}
                    className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    &larr; Back
                  </button>
                </div>
              </div>
            <p className="text-center text-xs text-slate-500 mt-4">The Hub &bull; Video Meeting Platform</p>
          </motion.div>
          </SocketProvider>
        )}

        {step === "waiting-for-host" && meetingInfo && activeMeetingId && (
          <SocketProvider guestName={guestName} guestMeetingId={activeMeetingId}>
            <WaitingRoomListener meetingId={activeMeetingId} onMeetingStarted={handleMeetingStarted} />
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
                    Listening for host...
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Scheduled for</p>
                    <p className="text-sm font-medium text-slate-600">
                      {new Date(meetingInfo.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>

                  <button
                    onClick={() => { setStep("enter-code"); setMeetingInfo(null); setActiveMeetingId(null); }}
                    className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    &larr; Back
                  </button>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 mt-4">The Hub &bull; Video Meeting Platform</p>
            </motion.div>
          </SocketProvider>
        )}

        {step === "meeting-ended" && (
          <motion.div
            key="meeting-ended"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold">Meeting Ended</h1>
                <p className="text-sm text-slate-300 mt-1">{meetingInfo?.title || "Video Meeting"}</p>
              </div>

              <div className="p-6 space-y-5">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-8 w-8 text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">The meeting has ended</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Thank you for joining!
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setStep("enter-code");
                    setActiveMeetingId(null);
                    setMeetingInfo(null);
                    setMeetingCode("");
                    setPassword("");
                    setGuestName("");
                    setAuthenticatedUser(null);
                    setIsHostStartingMeeting(false);
                  }}
                  className="w-full h-11 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700"
                >
                  Join Another Meeting
                </Button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-4">The Hub &bull; Video Meeting Platform</p>
          </motion.div>
        )}

        {step === "enter-code" && (
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
                  {isOneClickJoin && meetingInfo ? meetingInfo.title : isOneClickJoin ? "Loading meeting..." : "Enter the meeting code to join"}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Meeting Code and Password */}
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

                {/* Choice: Login or Join as Guest */}
                {!showGuestInput && !showPinPad && (
                  <div className="space-y-3">
                    <div className="text-center text-sm font-medium text-slate-600 mb-2">How would you like to join?</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setShowPinPad(true); setError(""); }}
                        disabled={!meetingCode.trim()}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <LogIn className="h-6 w-6 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-900">Login</span>
                        <span className="text-xs text-blue-600">Restaurant/ARL</span>
                      </button>
                      <button
                        onClick={() => { setShowGuestInput(true); setError(""); }}
                        disabled={!meetingCode.trim()}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <UserPlus className="h-6 w-6 text-green-600" />
                        <span className="text-sm font-semibold text-green-900">Join as Guest</span>
                        <span className="text-xs text-green-600">No login needed</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Guest Name Input */}
                {showGuestInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={guestName}
                          onChange={(e) => { setGuestName(e.target.value); setError(""); }}
                          placeholder="Enter your name"
                          className="pl-10"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => { setShowGuestInput(false); setGuestName(""); }}
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleGuestJoin}
                        disabled={loading || !guestName.trim()}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* PinPad Login */}
                {showPinPad && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Hidden input for keyboard support */}
                    <input
                      ref={keyboardInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      className="sr-only"
                      aria-hidden="true"
                      tabIndex={0}
                      style={{ position: 'absolute', left: -9999 }}
                    />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700 mb-4">
                        {pinPadStep === "userId" ? "Enter User ID" : "Enter PIN"}
                      </p>
                      <div className="flex justify-center gap-3 mb-6">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const currentValue = pinPadStep === "userId" ? userId : pin;
                          const filled = i < currentValue.length;
                          return (
                            <div key={i} className="relative flex items-center justify-center">
                              {/* Ripple ring when dot fills */}
                              {filled && (
                                <motion.div
                                  key={`ripple-${i}-${currentValue.length}`}
                                  className="absolute rounded-full border-2 border-red-600"
                                  initial={{ width: 20, height: 20, opacity: 0.7 }}
                                  animate={{ width: 36, height: 36, opacity: 0 }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              )}
                              <motion.div
                                className={`h-5 w-5 rounded-full border-2 transition-colors duration-200 ${
                                  filled
                                    ? "border-red-600 bg-red-600"
                                    : "border-slate-300 bg-white"
                                }`}
                                animate={filled ? { scale: [1, 1.3, 1] } : {}}
                                transition={{ duration: 0.15 }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((digit, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (digit === "⌫") handlePinPadDelete();
                            else if (digit) handlePinPadDigit(digit);
                          }}
                          disabled={!digit || loading}
                          className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-0 font-semibold text-lg text-slate-700 transition-colors"
                        >
                          {digit === "⌫" ? <Delete className="h-5 w-5 mx-auto" /> : digit}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handlePinPadBack}
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                    >
                      {pinPadStep === "pin" ? "← Back to User ID" : "← Cancel"}
                    </Button>
                  </motion.div>
                )}
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
