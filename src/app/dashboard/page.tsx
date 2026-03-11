"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import {
  CalendarDays,
  Video,
  X,
  CheckCircle2,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Timeline, type TaskItem } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { CompletedMissed } from "@/components/dashboard/completed-missed";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
// NotificationSystem merged into NotificationBell (unified single bell)
import { useHapticFeedback, useOnlineStatus } from "@/hooks/use-mobile-utils";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { EmergencyOverlay } from "@/components/dashboard/emergency-overlay";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { ConfettiBurst, CoinRain, Fireworks, useConfettiSound } from "@/components/dashboard/celebrations";
import { IdleScreensaver, useIdleTimer } from "@/components/dashboard/idle-screensaver";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import { HighFiveAnimation } from "@/components/high-five-animation";
import { AnimatedBackground } from "@/components/animated-background";
import { StreamViewer } from "@/components/dashboard/stream-viewer";
import { LiveTicker } from "@/components/dashboard/live-ticker";
import { playTaskSound, playBonusSound } from "@/lib/sound-effects";
import { OfflineIndicator } from "@/components/offline-indicator";
import { getRandomTaskCompletionPun, getCelebrationMessage } from "@/lib/funny-messages";
import { SeasonalTheme } from "@/components/dashboard/seasonal-theme";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MinimalHeader } from "@/components/dashboard/minimal-header";
import { CalendarModal } from "@/components/dashboard/calendar-modal";
import { RemoteViewBanner } from "@/components/dashboard/remote-view-banner";
import { ArlCursorOverlay } from "@/components/dashboard/arl-cursor-overlay";
import type { RemoteCaptureManager } from "@/lib/remote-capture";
import { useLayout } from "@/lib/layout-context";
import { FocusLayout } from "@/components/dashboard/layouts/focus";
import { useSearchParams } from "next/navigation";
import { MirrorProvider, useMirror } from "@/lib/mirror-context";
import { CursorOverlay } from "@/components/remote/cursor-overlay";
import { MirrorToolbar } from "@/components/remote/mirror-toolbar";

interface TasksResponse {
  tasks: TaskItem[];
  completedToday: number;
  totalToday: number;
  missedYesterday: TaskItem[];
  pointsToday: number;
}

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MirrorProvider>
        <DashboardPage />
      </MirrorProvider>
    </Suspense>
  );
}

function DashboardPage() {
  // ── Mirror mode detection ──
  const searchParams = useSearchParams();
  const mirrorLocationId = searchParams.get("mirror");
  const mirrorSessionId = searchParams.get("session");
  const mirrorLocationName = searchParams.get("locationName") || mirrorLocationId || "";
  const { isMirroring, startMirror, endMirror, viewState: mirrorViewState, sendViewChange, targetDevice } = useMirror();

  // Initialize mirror session on mount if URL params are present
  useEffect(() => {
    if (mirrorLocationId && mirrorSessionId && !isMirroring) {
      startMirror(mirrorLocationId, mirrorLocationName, mirrorSessionId);
    }
  }, [mirrorLocationId, mirrorSessionId, mirrorLocationName, isMirroring, startMirror]);

  const [screensaverEnabled, setScreensaverEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hub-screensaver-enabled");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [forceIdle, setForceIdle] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<"left" | "right" | null>(null);
  const [mobileView, setMobileView] = useState<string>("tasks");
  const [remoteViewActive, setRemoteViewActive] = useState(false);
  const captureManagerRef = useRef<RemoteCaptureManager | null>(null);

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

  // Settings and mobile menu state/effects are now inside DashboardHeader + DashboardSettings

  const { user, logout } = useAuth();
  const { layout, setLayout } = useLayout();
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

  // ── Mirror mode: sync view state from target ──
  const mirrorSyncingRef = useRef(false);
  useEffect(() => {
    if (!isMirroring || !mirrorViewState) return;
    mirrorSyncingRef.current = true;
    setChatOpen(mirrorViewState.chatOpen);
    setFormsOpen(mirrorViewState.formsOpen);
    setCalOpen(mirrorViewState.calendarOpen);
    if (mirrorViewState.layout) {
      setLayout(mirrorViewState.layout as any);
    }
    // Reset flag after React processes the batch
    requestAnimationFrame(() => { mirrorSyncingRef.current = false; });
  }, [isMirroring, mirrorViewState, setLayout]);

  // ── Mirror mode: send ARL's local view changes back to target ──
  useEffect(() => {
    if (!isMirroring || mirrorSyncingRef.current) return;
    sendViewChange({ chatOpen, formsOpen, calendarOpen: calOpen, layout });
  }, [isMirroring, chatOpen, formsOpen, calOpen, layout, sendViewChange]);

  // ── Target mode: listen for reverse view changes from ARL (mirror → target) ──
  const { socket: viewSyncSocket } = useSocket();
  useEffect(() => {
    if (isMirroring || !remoteViewActive || !viewSyncSocket) return;
    const onReverseView = (data: { sessionId: string; viewState: Record<string, unknown> }) => {
      const vs = data.viewState;
      if (vs.chatOpen !== undefined) setChatOpen(vs.chatOpen as boolean);
      if (vs.formsOpen !== undefined) setFormsOpen(vs.formsOpen as boolean);
      if (vs.calendarOpen !== undefined) setCalOpen(vs.calendarOpen as boolean);
      if (vs.layout) setLayout(vs.layout as string as any);
      // Relay accordion state to FocusLayout via DOM event
      if (vs.accordions) {
        window.dispatchEvent(new CustomEvent("mirror:accordion-sync", { detail: vs.accordions }));
      }
      // Relay panel open/close to NotificationBell / DashboardSettings via DOM events
      if (vs.notificationsOpen !== undefined) {
        window.dispatchEvent(new CustomEvent("mirror:panel-sync", { detail: { notificationsOpen: vs.notificationsOpen } }));
      }
      if (vs.settingsOpen !== undefined) {
        window.dispatchEvent(new CustomEvent("mirror:panel-sync", { detail: { settingsOpen: vs.settingsOpen } }));
      }
    };
    viewSyncSocket.on("mirror:view-change", onReverseView);
    return () => { viewSyncSocket.off("mirror:view-change", onReverseView); };
  }, [isMirroring, remoteViewActive, viewSyncSocket, setLayout]);

  // Disable screensaver while in a meeting, during remote view, or in mirror mode
  const idle = idleBase && !activeStream && !remoteViewActive && !isMirroring;

  const localTimeParams = () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const localDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
    let params = `localDate=${localDate}&localTime=${localTime}&localDay=${localDay}`;
    // In mirror mode, scope API calls to the target location
    if (mirrorLocationId) params += `&locationId=${mirrorLocationId}`;
    return params;
  };

  // Timestamp of last completion — suppresses socket-triggered fetchTasks
  // for 3s after a completion to prevent the optimistic update being overwritten.
  const completingRef = useRef(0);
  // Debounce ref — prevents rapid re-fetches during socket reconnects
  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    if (Date.now() - completingRef.current < 3000) return;
    // Debounce: skip if we fetched less than 2s ago, schedule a delayed fetch instead
    if (Date.now() - lastFetchRef.current < 2000) {
      if (!fetchDebounceRef.current) {
        fetchDebounceRef.current = setTimeout(() => {
          fetchDebounceRef.current = null;
          fetchTasks();
        }, 2000);
      }
      return;
    }
    lastFetchRef.current = Date.now();
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

  // Broadcast view state to mirror dashboard when being remote-viewed
  useEffect(() => {
    if (!remoteViewActive || !captureManagerRef.current) return;
    captureManagerRef.current.broadcastViewState({
      chatOpen,
      formsOpen,
      calendarOpen: calOpen,
      layout,
      mobileView,
    });
  }, [chatOpen, calOpen, formsOpen, layout, mobileView, remoteViewActive]);

  // Relay accordion state changes from FocusLayout to mirror via capture manager
  useEffect(() => {
    if (!remoteViewActive) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (captureManagerRef.current && detail) {
        captureManagerRef.current.broadcastViewState({ accordions: detail });
      }
    };
    window.addEventListener("mirror:accordion-change", handler);
    return () => window.removeEventListener("mirror:accordion-change", handler);
  }, [remoteViewActive]);

  // Relay notification/settings panel open/close from child components to mirror via capture manager
  useEffect(() => {
    if (!remoteViewActive) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (captureManagerRef.current && detail) {
        captureManagerRef.current.broadcastViewState(detail);
      }
    };
    window.addEventListener("mirror:panel-change", handler);
    return () => window.removeEventListener("mirror:panel-change", handler);
  }, [remoteViewActive]);

  const handleEarlyComplete = async (taskId: string, dateStr: string) => {
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          completedDate: dateStr,
          ...(mirrorLocationId ? { mirrorLocationId, mirrorLocationName } : {}),
        }),
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
        body: JSON.stringify({
          taskId,
          localDate,
          ...(mirrorLocationId ? { mirrorLocationId } : {}),
        }),
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
        body: JSON.stringify({
          taskId,
          localDate,
          ...(mirrorLocationId ? { mirrorLocationId, mirrorLocationName } : {}),
        }),
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

  // In mirror mode, use the target location ID for location-specific components
  const effectiveLocationId = mirrorLocationId || user?.id;

  // ── Mirror viewport scaling: render at target's exact dimensions ──
  const mirrorScale = (() => {
    if (!isMirroring || !targetDevice) return null;
    const tw = targetDevice.width;
    const th = targetDevice.height;
    if (!tw || !th) return null;
    const aw = typeof window !== "undefined" ? window.innerWidth : tw;
    const ah = typeof window !== "undefined" ? window.innerHeight : th;
    const scale = Math.min(aw / tw, ah / th);
    return { tw, th, scale };
  })();

  // In mirror mode, determine if target is mobile for layout decisions
  const targetIsMobile = isMirroring && targetDevice ? targetDevice.isMobile : false;

  // For layout decisions: use targetIsMobile when mirroring, otherwise let responsive classes handle it
  const useTargetMobile = isMirroring;

  const dashboardContent = (
    <div className={cn("flex flex-col overflow-hidden bg-[var(--background)] relative", mirrorScale ? "w-full h-full" : "h-dvh w-screen")}>

      {/* Offline indicator with sync status */}
      <OfflineIndicator />

      {/* Animated Background */}
      <AnimatedBackground variant="subtle" />

      {/* Header — Classic uses full DashboardHeader, others use MinimalHeader */}
      {layout === "classic" ? (
        <DashboardHeader
          user={user}
          displayTime={displayTime}
          allTasks={allTasks}
          currentTime={currentTime}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          screensaverEnabled={screensaverEnabled}
          onToggleScreensaver={() => setScreensaverEnabled((v) => !v)}
          onShowScreensaver={() => setForceIdle(true)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          chatUnread={chatUnread}
          onOpenForms={() => setFormsOpen(true)}
          onOpenCalendar={() => setCalOpen(true)}
          onLogout={logout}
        />
      ) : (
        <MinimalHeader
          user={user}
          displayTime={displayTime}
          allTasks={allTasks}
          currentTime={currentTime}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          screensaverEnabled={screensaverEnabled}
          onToggleScreensaver={() => setScreensaverEnabled((v) => !v)}
          onShowScreensaver={() => setForceIdle(true)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          chatUnread={chatUnread}
          onOpenForms={() => setFormsOpen(true)}
          onOpenCalendar={() => setCalOpen(true)}
          onLogout={logout}
        />
      )}

      {/* Main Content — layout-specific */}
      {layout === "classic" && (
        <>
          {/* Mobile Panel Toggle Buttons */}
          {(useTargetMobile ? targetIsMobile : true) && (
            <div className={cn("flex gap-2 px-4 py-2 border-b border-border bg-card", useTargetMobile ? "" : "md:hidden")}>
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
          )}

          {/* Main Content - 3 column layout, no scrolling */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Left Column - Completed/Missed + Points */}
            <div className={cn(
              "w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto",
              useTargetMobile ? (targetIsMobile ? (mobilePanelOpen === "left" ? "absolute inset-0 z-[999] w-full block" : "hidden") : "block") : "hidden md:block",
              !useTargetMobile && mobilePanelOpen === "left" ? "absolute inset-0 z-[999] w-full md:relative md:w-[280px] md:border-r md:border-border" : ""
            )}>
              {/* Mobile close button */}
              {mobilePanelOpen === "left" && (useTargetMobile ? targetIsMobile : true) && (
                <div className={cn("sticky top-0 z-[1000] bg-card border-b border-border px-4 py-3 flex items-center justify-between", useTargetMobile ? "" : "md:hidden")}>
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
              useTargetMobile ? (targetIsMobile && mobilePanelOpen ? "hidden" : "flex") : (mobilePanelOpen ? "hidden md:flex" : "flex")
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
              useTargetMobile ? (targetIsMobile ? (mobilePanelOpen === "right" ? "flex flex-col absolute inset-0 z-[999] w-full" : "hidden") : "flex flex-col") : "hidden lg:flex lg:flex-col",
              !useTargetMobile && mobilePanelOpen === "right" ? "flex flex-col absolute inset-0 z-[999] w-full lg:relative lg:w-[300px] lg:border-l lg:border-border" : ""
            )}>
              {/* Mobile close button */}
              {mobilePanelOpen === "right" && (useTargetMobile ? targetIsMobile : true) && (
                <div className={cn("sticky top-0 z-[120] bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0", useTargetMobile ? "" : "md:hidden")}>
                  <h3 className="text-sm font-bold text-foreground">Upcoming & Leaderboard</h3>
                  <button
                    onClick={() => setMobilePanelOpen(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <RightPanel upcomingTasks={upcomingTasks} onEarlyComplete={handleEarlyComplete} currentLocationId={effectiveLocationId} />
            </div>
          </div>
        </>
      )}

      {layout === "focus" && (
        <FocusLayout
          allTasks={allTasks}
          completedTasks={completedTasks}
          missedYesterday={data?.missedYesterday || []}
          pointsToday={data?.pointsToday || 0}
          totalToday={data?.totalToday || 0}
          currentTime={currentTime}
          displayTime={displayTime}
          upcomingTasks={upcomingTasks}
          currentLocationId={effectiveLocationId}
          onComplete={handleCompleteTask}
          onUncomplete={handleUncompleteTask}
          onEarlyComplete={handleEarlyComplete}
          targetIsMobile={useTargetMobile ? targetIsMobile : undefined}
        />
      )}

      {/* Live Activity Ticker — hidden during remote view to reduce capture noise */}
      {!remoteViewActive && !isMirroring && <LiveTicker currentLocationId={effectiveLocationId} />}

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

      {/* High-Five Animation — disabled during remote view and mirror mode */}
      {!remoteViewActive && !isMirroring && <HighFiveAnimation />}

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

      {/* Remote View Banner (auto-start + active session indicator) — skip in mirror mode */}
      {!isMirroring && <RemoteViewBanner onSessionChange={setRemoteViewActive} onCaptureManagerChange={(m) => { captureManagerRef.current = m; }} />}
      <ArlCursorOverlay remoteViewActive={remoteViewActive} />
    </div>
  );

  if (mirrorScale) {
    return (
      <>
        {/* Mirror mode UI — rendered outside the scaled container so they stay normal size */}
        <MirrorToolbar />
        <CursorOverlay />
        <div className="h-dvh w-screen overflow-hidden bg-black flex items-start justify-center">
          <div
            style={{
              width: mirrorScale.tw,
              height: mirrorScale.th,
              transform: `scale(${mirrorScale.scale})`,
              transformOrigin: "top center",
            }}
            className="shrink-0 relative"
          >
            {dashboardContent}
          </div>
        </div>
      </>
    );
  }

  // Not using viewport scaling (either not mirroring, or device info not yet received)
  if (isMirroring) {
    return (
      <>
        <MirrorToolbar />
        <CursorOverlay />
        {dashboardContent}
      </>
    );
  }

  return dashboardContent;
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



