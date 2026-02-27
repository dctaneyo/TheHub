"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from "date-fns";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  ChevronLeft,
  Video,
  ChevronRight,
  X,
  Clock,
  ClipboardList,
  SprayCan,
  Repeat,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Settings,
  Volume2,
  VolumeX,
  MonitorOff,
  Monitor,
  Play,
  Sun,
  Moon,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ConnectionStatus } from "@/components/connection-status";
import { Timeline, type TaskItem } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { CompletedMissed } from "@/components/dashboard/completed-missed";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
// NotificationSystem merged into NotificationBell (unified single bell)
import { useHapticFeedback, useOnlineStatus } from "@/hooks/use-mobile-utils";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { EmergencyOverlay } from "@/components/dashboard/emergency-overlay";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { GamificationHub } from "@/components/dashboard/gamification-hub";
import { ConfettiBurst, CoinRain, Fireworks, useConfettiSound } from "@/components/dashboard/celebrations";
import { IdleScreensaver, useIdleTimer } from "@/components/dashboard/idle-screensaver";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import { HighFiveAnimation } from "@/components/high-five-animation";
import { AnimatedBackground } from "@/components/animated-background";
import { StreamViewer } from "@/components/dashboard/stream-viewer";
import { LiveTicker } from "@/components/dashboard/live-ticker";
import { playTaskSound, playBonusSound } from "@/lib/sound-effects";
import { getRandomTaskCompletionPun, getCelebrationMessage } from "@/lib/funny-messages";
import { ThemeToggle } from "@/components/theme-toggle";
import { SeasonalTheme } from "@/components/dashboard/seasonal-theme";
import { NotificationBell } from "@/components/notification-bell";
import { CalendarModal } from "@/components/dashboard/calendar-modal";

interface TasksResponse {
  tasks: TaskItem[];
  completedToday: number;
  totalToday: number;
  missedYesterday: TaskItem[];
  pointsToday: number;
}

export default function DashboardPage() {
  const [screensaverEnabled, setScreensaverEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hub-screensaver-enabled");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [forceIdle, setForceIdle] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPos, setSettingsPos] = useState<{ top: number; right: number } | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<"left" | "right" | null>(null);
  const [mobileView, setMobileView] = useState<string>("tasks");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuPos, setMobileMenuPos] = useState<{ top: number; left: number } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Persist screensaver toggle to localStorage
  useEffect(() => {
    localStorage.setItem("hub-screensaver-enabled", String(screensaverEnabled));
  }, [screensaverEnabled]);

  const { idle: autoIdle, reset: resetIdle } = useIdleTimer(2 * 60 * 1000);
  // Disable screensaver on mobile devices
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const idleBase = !isMobile && screensaverEnabled && (autoIdle || forceIdle);

  // Load sound state from server on mount; listen for ARL-driven toggle
  const { socket: socketForSound } = useSocket();
  useEffect(() => {
    fetch('/api/locations/sound')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSoundEnabled(!d.muted); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!socketForSound) return;
    const handler = (data: { muted: boolean }) => setSoundEnabled(!data.muted);
    socketForSound.on('location:sound-toggle', handler);
    return () => { socketForSound.off('location:sound-toggle', handler); };
  }, [socketForSound]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    fetch('/api/locations/sound', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: !next }),
    }).catch(() => {});
  };

  // ── Color expiry toast state ──
  const [colorExpiryToast, setColorExpiryToast] = useState<{ color: string; bg: string; text: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Shared AudioContext — created fresh per-call inside a user-gesture-safe wrapper ──
  // We do NOT use a persistent ref because Chrome suspends contexts created outside
  // a user gesture. Instead we create a fresh one each time and immediately resume it.
  const playChime = useCallback((onDone: () => void) => {
    try {
      const ctx = new AudioContext();
      const go = () => {
        // Rising 3-note chime: C5 → E5 → G5
        const notes = [
          { freq: 523.25, start: 0,    dur: 0.55 },
          { freq: 659.25, start: 0.35, dur: 0.55 },
          { freq: 783.99, start: 0.70, dur: 0.90 },
        ];
        notes.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        });
        setTimeout(() => { onDone(); ctx.close(); }, 1800 + 150);
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(go).catch(() => { onDone(); });
      } else {
        go();
      }
    } catch {
      onDone();
    }
  }, []);

  // ── Voice announcements: speak 5 min before each color slot boundary ──
  const voiceAnnouncedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const COLOR_DATA = [
      { name: "Red",    bg: "#ef4444", text: "#fff" },
      { name: "Orange", bg: "#f97316", text: "#fff" },
      { name: "Yellow", bg: "#eab308", text: "#000" },
      { name: "Green",  bg: "#22c55e", text: "#fff" },
      { name: "Blue",   bg: "#3b82f6", text: "#fff" },
      { name: "Purple", bg: "#a855f7", text: "#fff" },
      { name: "Brown",  bg: "#92400e", text: "#fff" },
      { name: "Grey",   bg: "#9ca3af", text: "#fff" },
      { name: "White",  bg: "#f8fafc", text: "#000" },
    ];
    const ANCHOR_MINUTES = 10 * 60;
    const SLOT_MINS = 30;
    const ANNOUNCE_BEFORE_SECS = 5 * 60;

    function getSlotIndex(now: Date) {
      const mins = now.getHours() * 60 + now.getMinutes();
      const delta = ((mins - ANCHOR_MINUTES) % (9 * SLOT_MINS) + 9 * SLOT_MINS) % (9 * SLOT_MINS);
      return Math.floor(delta / SLOT_MINS);
    }

    function secsToNextBoundary(now: Date) {
      const totalSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const secsIntoSlot = totalSecs % (SLOT_MINS * 60);
      return SLOT_MINS * 60 - secsIntoSlot;
    }

    function speak(text: string) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;
      utt.pitch = 1.05;
      utt.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        /google us english/i.test(v.name) ||
        /samantha/i.test(v.name) ||
        /karen/i.test(v.name) ||
        /daniel/i.test(v.name) ||
        /moira/i.test(v.name)
      ) ?? voices.find(v => v.lang === 'en-US') ?? voices[0];
      if (preferred) utt.voice = preferred;
      window.speechSynthesis.speak(utt);
    }

    const interval = setInterval(() => {
      if (!soundEnabled) return;
      const now = new Date();
      const secs = secsToNextBoundary(now);
      if (secs > ANNOUNCE_BEFORE_SECS || secs <= ANNOUNCE_BEFORE_SECS - 5) return;

      const slotIdx = getSlotIndex(now);
      const colorData = COLOR_DATA[slotIdx];
      const boundaryMin = Math.floor((now.getHours() * 60 + now.getMinutes() + 5) / SLOT_MINS) * SLOT_MINS;
      const key = `${boundaryMin}`;
      if (voiceAnnouncedRef.current.has(key)) return;
      voiceAnnouncedRef.current.add(key);

      setColorExpiryToast({ color: colorData.name, bg: colorData.bg, text: colorData.text });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setColorExpiryToast(null), 12000);

      // Silence audible alert between 11 PM and 9 AM
      const hour = now.getHours();
      if (hour >= 23 || hour < 9) return;
      playChime(() => speak(`Heads up — ${colorData.name} is expiring in 5 minutes.`));
    }, 1000);

    return () => clearInterval(interval);
  }, [soundEnabled, playChime]);

  // Close settings popover on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  // Compute fixed position when settings dropdown opens
  useEffect(() => {
    if (settingsOpen && settingsRef.current) {
      const rect = settingsRef.current.getBoundingClientRect();
      setSettingsPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, [settingsOpen]);

  // Compute fixed position when mobile menu opens
  useEffect(() => {
    if (mobileMenuOpen && mobileMenuRef.current) {
      const rect = mobileMenuRef.current.getBoundingClientRect();
      setMobileMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [mobileMenuOpen]);

  const { user, logout } = useAuth();
  const [data, setData] = useState<TasksResponse | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string }>>>({});
  const [currentTime, setCurrentTime] = useState("");
  const [displayTime, setDisplayTime] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPoints, setConfettiPoints] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [showCoinRain, setShowCoinRain] = useState(false);
  const [coinRainAmount, setCoinRainAmount] = useState(0);
  const [showFireworks, setShowFireworks] = useState(false);
  const [activeStream, setActiveStream] = useState<{ broadcastId: string; arlName: string; title: string } | null>(null);
  const [pendingMeeting, setPendingMeeting] = useState<{ broadcastId: string; arlName: string; title: string } | null>(null);
  const [showMeetingNotification, setShowMeetingNotification] = useState(false);
  const playConfettiSound = useConfettiSound();

  // Disable screensaver while in a meeting
  const idle = idleBase && !activeStream;

  const localTimeParams = () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const localDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
    return `localDate=${localDate}&localTime=${localTime}&localDay=${localDay}`;
  };

  // Timestamp of last completion — suppresses socket-triggered fetchTasks
  // for 3s after a completion to prevent the optimistic update being overwritten.
  const completingRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    if (Date.now() - completingRef.current < 3000) return;
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`/api/tasks/today?${localTimeParams()}`),
        fetch(`/api/tasks/upcoming?${localTimeParams()}`),
      ]);
      if (todayRes.ok) {
        const json = await todayRes.json();
        setData(json);
      }
      if (upcomingRes.ok) {
        const json = await upcomingRes.json();
        setUpcomingTasks(json.upcoming);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }, []);

  // Hoist socket so it's available in the clock effect below
  const { socket, updateActivity } = useSocket();

  // Update current time every second for display; task logic still uses HH:mm.
  // Also detects midnight rollover and immediately re-fetches tasks for the new day.
  const currentDateRef = useRef<string>("");
  const lastMinuteRef = useRef<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setCurrentTime(hhmm);
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      setDisplayTime(`${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`);
      
      // Recalculate task statuses every minute
      if (lastMinuteRef.current !== hhmm) {
        lastMinuteRef.current = hhmm;
        const nowMinutes = h * 60 + m;
        
        setData((prev) => {
          if (!prev) return prev;
          const updatedTasks = prev.tasks.map((task) => {
            if (task.isCompleted) return task;
            const [taskH, taskM] = task.dueTime.split(":").map(Number);
            const taskMinutes = taskH * 60 + taskM;
            const isOverdue = taskMinutes < nowMinutes;
            const isDueSoon = !isOverdue && taskMinutes >= nowMinutes && taskMinutes <= nowMinutes + 30;
            
            return {
              ...task,
              isOverdue,
              isDueSoon,
            };
          });
          
          return {
            ...prev,
            tasks: updatedTasks,
          };
        });
      }
      
      // Detect date rollover (midnight) — emit to server so it reschedules timers;
      // server responds with task:updated which triggers fetchTasks via socket listener.
      if (currentDateRef.current && currentDateRef.current !== dateStr) {
        completingRef.current = 0;
        socket?.emit("client:day-reset");
        fetchTasks(); // immediate local re-fetch in case socket is momentarily slow
      }
      currentDateRef.current = dateStr;
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [fetchTasks, socket]);

  // Fetch tasks on mount + listen for instant WebSocket updates (no polling needed)
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!socket) return;
    const handleTaskUpdate = () => fetchTasks();
    socket.on("task:updated", handleTaskUpdate);
    socket.on("task:completed", handleTaskUpdate);
    
    // Listen for meeting events
    const handleMeetingStarted = (data: { meetingId: string; hostName: string; title: string }) => {
      setPendingMeeting({ broadcastId: data.meetingId, arlName: data.hostName, title: data.title });
      setShowMeetingNotification(true);
    };
    const handleMeetingEnded = (data: { meetingId: string }) => {
      setActiveStream(prev => prev?.broadcastId === data.meetingId ? null : prev);
      setPendingMeeting(prev => prev?.broadcastId === data.meetingId ? null : prev);
      setShowMeetingNotification(false);
    };
    // Check for already-active meetings (location logged in after meeting started)
    const handleMeetingList = (data: { meetings: Array<{ meetingId: string; hostName: string; title: string }> }) => {
      if (data.meetings.length > 0 && !pendingMeeting && !activeStream) {
        const m = data.meetings[0];
        setPendingMeeting({ broadcastId: m.meetingId, arlName: m.hostName, title: m.title });
        setShowMeetingNotification(true);
      }
    };
    socket.on("meeting:started", handleMeetingStarted);
    socket.on("meeting:ended", handleMeetingEnded);
    socket.on("meeting:list", handleMeetingList);
    // Request active meetings on connect
    socket.emit("meeting:list");
    
    return () => {
      socket.off("task:updated", handleTaskUpdate);
      socket.off("task:completed", handleTaskUpdate);
      socket.off("meeting:started", handleMeetingStarted);
      socket.off("meeting:ended", handleMeetingEnded);
      socket.off("meeting:list", handleMeetingList);
    };
  }, [socket, fetchTasks]);

  // Sync mobileView with panel/modal open states
  useEffect(() => {
    if (chatOpen) setMobileView("chat");
    else if (calOpen) setMobileView("calendar");
    else if (formsOpen) setMobileView("forms");
    else setMobileView("tasks");
  }, [chatOpen, calOpen, formsOpen]);

  const handleMobileViewChange = (view: string) => {
    setMobileView(view);
    if (view === "chat") { setChatOpen(true); setCalOpen(false); setFormsOpen(false); }
    else if (view === "calendar") { setCalOpen(true); setChatOpen(false); setFormsOpen(false); }
    else if (view === "leaderboard") { setMobilePanelOpen("right"); setChatOpen(false); setCalOpen(false); }
    else { setChatOpen(false); setCalOpen(false); setFormsOpen(false); setMobilePanelOpen(null); }
  };

  // Activity tracking — report which section the location is viewing
  useEffect(() => {
    const page = chatOpen ? "Chat" : calOpen ? "Calendar" : formsOpen ? "Forms" : "Dashboard";
    updateActivity(page);
  }, [chatOpen, calOpen, formsOpen, updateActivity]);

  const handleEarlyComplete = async (taskId: string, dateStr: string) => {
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, completedDate: dateStr }),
      });
      if (res.ok) {
        const result = await res.json();
        setConfettiPoints(result.pointsEarned || 0);
        if (result.bonusPoints > 0) {
          setCoinRainAmount(result.bonusPoints);
          setShowCoinRain(true);
          setTimeout(() => setShowCoinRain(false), 3000);
        } else {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2800);
        }
        playConfettiSound();
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to early-complete task:", err);
    }
  };

  const handleUncompleteTask = async (taskId: string) => {
    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      await fetch("/api/tasks/uncomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, localDate }),
      });
      // Reset the completion lock so fetchTasks isn't suppressed
      completingRef.current = 0;
      await fetchTasks();
    } catch (err) {
      console.error("Failed to uncomplete task:", err);
    }
  };

  const haptic = useHapticFeedback();
  const isOnline = useOnlineStatus();

  const handleCompleteTask = async (taskId: string) => {
    // Haptic feedback on task completion
    haptic([50, 30, 80]);
    // Record completion time — suppresses socket-triggered fetchTasks for 3s
    completingRef.current = Date.now();

    // Optimistic update — immediately mark completed so the UI never reverts
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, isCompleted: true, isOverdue: false, isDueSoon: false } : t
        ),
        completedToday: prev.completedToday + 1,
      };
    });

    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, localDate }),
      });

      if (res.ok) {
        const result = await res.json();
        setConfettiPoints(result.pointsEarned || 0);
        
        // Play task completion sound
        const task = allTasks.find(t => t.id === taskId);
        if (soundEnabled && task) {
          playTaskSound(task.type as any);
        }
        
        // Play bonus sound if bonus points awarded
        if (result.bonusPoints > 0 && soundEnabled) {
          setTimeout(() => playBonusSound(), 300);
        }
        
        playConfettiSound();
        
        // Fetch confirmed state to check all-done and update points
        const updatedRes = await fetch(`/api/tasks/today?${localTimeParams()}`);
        if (updatedRes.ok) {
          const updated = await updatedRes.json();
          const allDone = (updated.tasks || []).length > 0 && (updated.tasks || []).every((t: any) => t.isCompleted);
          if (allDone) {
            setShowFireworks(true);
            setTimeout(() => setShowFireworks(false), 3500);
          } else {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2800);
          }
          setData(updated);
        } else {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2800);
        }
      } else {
        // Revert optimistic update on failure — bypass the lock
        completingRef.current = 0;
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
      completingRef.current = 0;
      await fetchTasks();
    }
  };

  const completedTasks = data?.tasks.filter((t) => t.isCompleted) || [];
  const allTasks = data?.tasks || [];

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[var(--background)] relative">
      {/* Offline indicator banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md"
          >
            You&apos;re offline — some features may not work
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Background */}
      <AnimatedBackground variant="subtle" />

      {/* Top Bar */}
      <header className="sticky top-0 flex h-16 shrink-0 items-center border-b border-border bg-card px-4 md:px-6 z-[100]">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-sm transition-transform active:scale-95"
            >
              <span className="text-base font-black text-white">H</span>
            </button>
            <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-sm">
              <span className="text-base font-black text-white">H</span>
            </div>

            {/* Mobile Navigation Menu */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-[200] w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
                  style={mobileMenuPos ? { top: mobileMenuPos.top, left: mobileMenuPos.left } : {}}
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Menu</p>
                  </div>

                  <div className="p-2 space-y-1">
                    {/* Forms */}
                    <button
                      onClick={() => { setFormsOpen(true); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Forms</p>
                        <p className="text-xs text-muted-foreground">View documents</p>
                      </div>
                    </button>

                    {/* Calendar */}
                    <button
                      onClick={() => { setCalOpen(true); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Calendar</p>
                        <p className="text-xs text-muted-foreground">View schedule</p>
                      </div>
                    </button>

                    {/* Connection Status */}
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Connection</p>
                      <ConnectionStatus />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="hidden md:block">
            <h1 className="text-base font-bold text-foreground">The Hub</h1>
            <p className="text-[11px] text-muted-foreground">
              {user?.name} &middot; Store #{user?.storeNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">
          {/* Unified Gamification Hub */}
          <GamificationHub locationId={user?.id} />

          {/* Connection status - hide on small mobile */}
          <div className="hidden sm:block">
            <ConnectionStatus />
          </div>

          {/* Clock - hide on mobile */}
          <div className="hidden md:block mx-1 text-right">
            <p className="text-2xl font-black tabular-nums tracking-tight text-foreground">
              {displayTime}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              {format(new Date(), "EEE, MMM d yyyy")}
            </p>
          </div>

          {/* Action buttons - hide some on mobile */}
          <button
            onClick={() => setFormsOpen(true)}
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
            title="Forms"
          >
            <FileText className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={() => setCalOpen(true)}
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
            title="Calendar"
          >
            <CalendarDays className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
            title="Chat"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            {chatUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hub-red)] text-[10px] font-bold text-white">
                {chatUnread}
              </span>
            )}
          </button>

          {/* Unified Notification Bell (task alerts + DB notifications) */}
          <NotificationBell
            tasks={allTasks}
            currentTime={currentTime}
            soundEnabled={soundEnabled}
          />

          {/* Settings cog */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                settingsOpen ? "bg-muted text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-[200] w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
                  style={settingsPos ? { top: settingsPos.top, right: settingsPos.right } : {}}
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dashboard Settings</p>
                  </div>

                  <div className="p-2 space-y-1">
                    {/* Sound toggle */}
                    <button
                      onClick={toggleSound}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        soundEnabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-50 text-red-400 dark:bg-red-950 dark:text-red-400"
                      )}>
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Notification Sound</p>
                        <p className="text-[11px] text-muted-foreground">{soundEnabled ? "Sounds on" : "Muted"}</p>
                      </div>
                      <div className={cn(
                        "h-5 w-9 rounded-full transition-colors relative",
                        soundEnabled ? "bg-emerald-500" : "bg-slate-200"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          soundEnabled ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </div>
                    </button>

                    {/* Screensaver toggle */}
                    <button
                      onClick={() => setScreensaverEnabled((v) => !v)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        screensaverEnabled ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" : "bg-muted text-muted-foreground"
                      )}>
                        {screensaverEnabled ? <Monitor className="h-4 w-4" /> : <MonitorOff className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Screensaver</p>
                        <p className="text-[11px] text-muted-foreground">{screensaverEnabled ? "Auto after 2 min" : "Disabled"}</p>
                      </div>
                      <div className={cn(
                        "h-5 w-9 rounded-full transition-colors relative",
                        screensaverEnabled ? "bg-blue-500" : "bg-slate-200"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          screensaverEnabled ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </div>
                    </button>

                    {/* Theme toggle */}
                    <div className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                        <Sun className="h-4 w-4 dark:hidden" />
                        <Moon className="h-4 w-4 hidden dark:block" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Theme</p>
                        <p className="text-[11px] text-slate-400">Light / Dark / System</p>
                      </div>
                      <ThemeToggle />
                    </div>

                    {/* Manual invoke */}
                    <button
                      onClick={() => { setForceIdle(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                        <Play className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Show Screensaver</p>
                        <p className="text-[11px] text-slate-400">Preview now</p>
                      </div>
                    </button>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* Mobile Panel Toggle Buttons */}
      <div className="md:hidden flex gap-2 px-4 py-2 border-b border-border bg-card">
        <button
          onClick={() => setMobilePanelOpen(mobilePanelOpen === "left" ? null : "left")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
            mobilePanelOpen === "left" ? "bg-[var(--hub-red)] text-white" : "bg-muted text-muted-foreground"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Completed/Missed
        </button>
        <button
          onClick={() => setMobilePanelOpen(mobilePanelOpen === "right" ? null : "right")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
            mobilePanelOpen === "right" ? "bg-[var(--hub-red)] text-white" : "bg-muted text-muted-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Upcoming
        </button>
      </div>

      {/* Main Content - 3 column layout, no scrolling */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Column - Completed/Missed + Points */}
        <div className={cn(
          "w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto",
          "md:block",
          mobilePanelOpen === "left" ? "block absolute inset-0 z-[999] w-full" : "hidden"
        )}>
          {/* Mobile close button */}
          {mobilePanelOpen === "left" && (
            <div className="md:hidden sticky top-0 z-[1000] bg-card border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Completed & Missed</h3>
              <button
                onClick={() => setMobilePanelOpen(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="p-4">
            <CompletedMissed
              completedToday={completedTasks}
              missedYesterday={data?.missedYesterday || []}
              pointsToday={data?.pointsToday || 0}
              totalToday={data?.totalToday || 0}
            />
          </div>
        </div>

        {/* Center Column - Main Timeline */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden",
          mobilePanelOpen ? "hidden md:flex" : "flex"
        )}>
          <div className="shrink-0 px-5 pt-5">
            <SeasonalTheme showFloating={false} />
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
            {currentTime && (
              <Timeline
                tasks={allTasks}
                onComplete={handleCompleteTask}
                onUncomplete={handleUncompleteTask}
                currentTime={currentTime}
              />
            )}
          </div>
        </div>

        {/* Right Column - Mini Calendar + Leaderboard tabs */}
        <div className={cn(
          "w-[300px] shrink-0 border-l border-border bg-card overflow-hidden",
          "lg:flex lg:flex-col",
          mobilePanelOpen === "right" ? "flex flex-col absolute inset-0 z-[999] w-full" : "hidden"
        )}>
          {/* Mobile close button */}
          {mobilePanelOpen === "right" && (
            <div className="md:hidden sticky top-0 z-[120] bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-foreground">Upcoming & Leaderboard</h3>
              <button
                onClick={() => setMobilePanelOpen(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <RightPanel upcomingTasks={upcomingTasks} onEarlyComplete={handleEarlyComplete} currentLocationId={user?.id} />
        </div>
      </div>

      {/* Live Activity Ticker */}
      <LiveTicker currentLocationId={user?.id} />

      {/* Celebrations */}
      <ConfettiBurst active={showConfetti} points={confettiPoints} onComplete={() => setShowConfetti(false)} />
      <CoinRain active={showCoinRain} amount={coinRainAmount} onComplete={() => setShowCoinRain(false)} />
      <Fireworks active={showFireworks} onComplete={() => setShowFireworks(false)} />

      {/* Full Calendar Modal */}
      {calOpen && <CalendarModal onClose={() => setCalOpen(false)} locationId={user?.id} />}

      {/* Forms Viewer Modal */}
      {formsOpen && <FormsViewer onClose={() => setFormsOpen(false)} />}

      {/* Color expiry toast — only shown when screensaver is not active */}
      <AnimatePresence>
        {colorExpiryToast && !idle && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl"
            style={{ background: "rgba(15,15,25,0.92)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
          >
            {/* Color chip */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-sm"
              style={{ background: colorExpiryToast.bg, color: colorExpiryToast.text, boxShadow: `0 0 16px ${colorExpiryToast.bg}99` }}
            >
              {colorExpiryToast.color[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {colorExpiryToast.color} expiring in 5 min
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">Discard {colorExpiryToast.color} tags at the next color change</p>
            </div>
            <button
              onClick={() => setColorExpiryToast(null)}
              className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/30 hover:text-white/70 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle Screensaver */}
      <AnimatePresence>
        {idle && <IdleScreensaver onActivity={() => { setForceIdle(false); resetIdle(); }} />}
      </AnimatePresence>

      {/* Emergency Broadcast Overlay */}
      <EmergencyOverlay />

      {/* High-Five Animation */}
      <HighFiveAnimation />

      {/* Meeting Join Notification */}
      <AnimatePresence>
        {showMeetingNotification && pendingMeeting && !activeStream && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-card rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 p-5 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Video className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-600 uppercase">Live Meeting</span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{pendingMeeting.title}</p>
                  <p className="text-xs text-muted-foreground">by {pendingMeeting.arlName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveStream(pendingMeeting);
                    setShowMeetingNotification(false);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors"
                >
                  Join Meeting
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Stream Viewer */}
      {activeStream && (
        <StreamViewer
          broadcastId={activeStream.broadcastId}
          arlName={activeStream.arlName}
          title={activeStream.title}
          onClose={() => setActiveStream(null)}
        />
      )}

      {/* Restaurant Chat Drawer */}
      <RestaurantChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        unreadCount={chatUnread}
        onUnreadChange={setChatUnread}
        currentUserId={user?.id}
      />
    </div>
  );
}

function RightPanel({
  upcomingTasks,
  onEarlyComplete,
  currentLocationId,
}: {
  upcomingTasks: Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string; allowEarlyComplete?: boolean; isCompleted?: boolean }>>;
  onEarlyComplete: (taskId: string, dateStr: string) => void;
  currentLocationId?: string;
}) {
  const [tab, setTab] = useState<"calendar" | "leaderboard">("calendar");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex shrink-0 border-b border-border">
        <button
          onClick={() => setTab("calendar")}
          className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors ${tab === "calendar" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-muted-foreground hover:text-foreground"}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors ${tab === "leaderboard" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-muted-foreground hover:text-foreground"}`}
        >
          🏆 Leaderboard
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {tab === "calendar" ? (
          <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
        ) : (
          <Leaderboard currentLocationId={currentLocationId} compact />
        )}
      </div>
      <div className="shrink-0 p-4 pt-0">
        <MotivationalQuote />
      </div>
    </div>
  );
}



