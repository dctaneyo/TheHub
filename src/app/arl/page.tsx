"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  MessageCircle,
  ClipboardList,
  Users,
  Store,
  FileText,
  Settings,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  CalendarDays,
  ChevronLeft,
  Clock,
  SprayCan,
  Repeat,
  Radio,
  Bell,
  BellOff,
  Trophy,
  Monitor,
  Zap,
  CheckCircle2,
  Wifi,
  Database,
  Video,
  TrendingUp,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { ConnectionStatus } from "@/components/connection-status";
import { TaskManager } from "@/components/arl/task-manager";
import { LocationsManager } from "@/components/arl/locations-manager";
import { Messaging } from "@/components/arl/messaging";
import { FormsRepository } from "@/components/arl/forms-repository";
import { UserManagement } from "@/components/arl/user-management";
import { EmergencyBroadcast } from "@/components/arl/emergency-broadcast";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { RemoteLogin } from "@/components/arl/remote-login";
import { DataManagement } from "@/components/arl/data-management";
import { ShoutoutsFeed } from "@/components/shoutouts-feed";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { HighFiveAnimation } from "@/components/high-five-animation";
import { SocialActionsMenu } from "@/components/social-actions-menu";
import { BroadcastStudio } from "@/components/arl/broadcast-studio";
import { ScheduledMeetings } from "@/components/arl/scheduled-meetings";
import { MeetingAnalyticsDashboard } from "@/components/arl/meeting-analytics";
import { StreamViewer } from "@/components/dashboard/stream-viewer";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnalyticsDashboard } from "@/components/arl/analytics-dashboard";
import { GlobalSearch } from "@/components/global-search";
import { TickerPush } from "@/components/arl/ticker-push";
import { NotificationBell } from "@/components/notification-bell";
import { useSwipeNavigation, useOnlineStatus } from "@/hooks/use-mobile-utils";
import { NotificationTester } from "@/components/arl/notification-tester";
import { PageIndicator } from "@/components/arl/page-indicator";

type DeviceType = "desktop" | "tablet" | "mobile";
type ArlView = "overview" | "messages" | "tasks" | "calendar" | "locations" | "forms" | "emergency" | "users" | "leaderboard" | "remote-login" | "data-management" | "broadcast" | "meetings" | "analytics";

function useDeviceType(): DeviceType {
  const getDevice = (w: number): DeviceType => {
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };

  const [device, setDevice] = useState<DeviceType>("desktop");
  const lastWidthRef = useRef<number>(0);

  useEffect(() => {
    lastWidthRef.current = window.innerWidth;
    setDevice(getDevice(window.innerWidth));

    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      // Only re-evaluate when WIDTH changes — ignore height-only changes
      // (iOS Safari fires resize on scroll when address bar collapses)
      const w = window.innerWidth;
      if (w === lastWidthRef.current) return;
      lastWidthRef.current = w;
      clearTimeout(timer);
      timer = setTimeout(() => setDevice(getDevice(w)), 100);
    };
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      clearTimeout(timer);
    };
  }, []);

  return device;
}

const navItems = [
  { id: "overview" as const, label: "Overview", icon: BarChart3 },
  { id: "messages" as const, label: "Messages", icon: MessageCircle },
  { id: "tasks" as const, label: "Tasks & Reminders", icon: ClipboardList },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
  { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
  { id: "locations" as const, label: "Locations", icon: Store },
  { id: "meetings" as const, label: "Meetings", icon: Video },
  { id: "emergency" as const, label: "Emergency Broadcast", icon: Radio },
  { id: "users" as const, label: "Users", icon: Users },
  { id: "remote-login" as const, label: "Remote Login", icon: Monitor },
  { id: "data-management" as const, label: "Data Management", icon: Database },
  { id: "analytics" as const, label: "Analytics", icon: TrendingUp },
];

interface TaskToast {
  id: string;
  locationName: string;
  taskTitle: string;
  pointsEarned: number;
}

export default function ArlPage() {
  const { user, logout } = useAuth();
  const device = useDeviceType();
  const [activeView, setActiveView] = useState<ArlView>("overview");
  const [mounted, setMounted] = useState(false);

  // Restore active view from sessionStorage after mount (prevents hydration mismatch)
  useEffect(() => {
    const saved = sessionStorage.getItem("arl-active-view") as ArlView | null;
    if (saved && ["overview","messages","tasks","calendar","locations","forms","emergency","users","leaderboard","remote-login","data-management","broadcast","meetings","analytics"].includes(saved)) {
      setActiveView(saved);
    }
    setMounted(true);
  }, []);

  // Persist active view so it survives unexpected remounts
  useEffect(() => {
    if (mounted) {
      sessionStorage.setItem("arl-active-view", activeView);
    }
  }, [activeView, mounted]);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth < 1024) {
      return true; // Auto-open on tablet landscape
    }
    return false;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [toasts, setToasts] = useState<TaskToast[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [activeBroadcast, setActiveBroadcast] = useState<{ broadcastId: string; arlName: string; title: string } | null>(null);
  const [showBroadcastNotification, setShowBroadcastNotification] = useState(false);
  const [watchingBroadcast, setWatchingBroadcast] = useState(false);
  const [leftMeetingId, setLeftMeetingId] = useState<string | null>(null); // Track meeting user left for rejoin
  const [activeMeetings, setActiveMeetings] = useState<Array<{ meetingId: string; title: string; hostName: string; hostId: string }>>([]);
  const [joiningMeeting, setJoiningMeeting] = useState<{ meetingId: string; title: string } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const locationNamesRef = useRef<Map<string, string>>(new Map());

  const isMobileOrTablet = device === "mobile" || device === "tablet";
  const isOnline = useOnlineStatus();
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  // Swipe navigation between views on mobile with direction tracking
  const swipeViewIds = navItems.map((n) => n.id);
  const handleViewChange = useCallback((newView: string) => {
    const oldIndex = swipeViewIds.indexOf(activeView as string);
    const newIndex = swipeViewIds.indexOf(newView);
    setSwipeDirection(newIndex > oldIndex ? 1 : -1);
    setActiveView(newView as ArlView);
  }, [activeView, swipeViewIds]);
  
  useSwipeNavigation(swipeViewIds, activeView as string, handleViewChange, isMobileOrTablet && !sidebarOpen);

  // Play subtle 2-note beep for new messages (ARL office environment — not a loud kitchen)
  const playMessageChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      [[660, 0, 0.12], [880, 0.15, 0.18]].forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur);
      });
    } catch {}
  }, []);

  // Play a cheerful chime for task completions
  const playTaskChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      [[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.12], [1047, 0.26, 0.2]].forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur);
      });
    } catch {}
  }, []);

  const { socket, updateActivity } = useSocket();

  // Activity tracking — report which section the ARL is viewing
  useEffect(() => {
    updateActivity(activeView);
  }, [activeView, updateActivity]);

  // Track online location IDs in a ref so presence:update can delta-update
  // without triggering a full HTTP fetch on every heartbeat.
  const onlineLocationIdsRef = useRef<Set<string>>(new Set());

  // Fetch online count + cache location names (called once on mount only)
  const fetchOnlineCount = useCallback(() => {
    fetch("/api/locations").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        const locs: any[] = d.locations || [];
        const arls: any[] = d.arls || [];
        const onlineLocs = locs.filter((l) => l.isOnline);
        onlineLocationIdsRef.current = new Set(onlineLocs.map((l) => l.id));
        setOnlineCount(onlineLocs.length);
        const map = new Map<string, string>();
        for (const l of locs) map.set(l.id, l.name);
        for (const a of arls) map.set(a.id, a.name);
        locationNamesRef.current = map;
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchOnlineCount(); }, [fetchOnlineCount]);

  // Listen for task completions → toast + chime
  useEffect(() => {
    if (!socket) return;
    const handleTaskCompleted = (data: { locationId: string; taskId: string; taskTitle: string; pointsEarned: number }) => {
      const locName = locationNamesRef.current.get(data.locationId) || "A location";
      const toast: TaskToast = {
        id: `${data.taskId}-${Date.now()}`,
        locationName: locName,
        taskTitle: data.taskTitle,
        pointsEarned: data.pointsEarned,
      };
      setToasts((prev) => [...prev, toast]);
      playTaskChime();
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };
    socket.on("task:completed", handleTaskCompleted);
    return () => { socket.off("task:completed", handleTaskCompleted); };
  }, [socket, playTaskChime]);

  // Delta-update online count from presence:update events — no HTTP fetch needed.
  // Only location presence affects the nav badge (ARL count not shown there).
  useEffect(() => {
    if (!socket) return;
    const handlePresence = (data: { userId: string; userType: string; isOnline: boolean }) => {
      if (data.userType !== "location") return;
      const ids = onlineLocationIdsRef.current;
      const wasOnline = ids.has(data.userId);
      if (data.isOnline && !wasOnline) {
        ids.add(data.userId);
        setOnlineCount((c) => c + 1);
      } else if (!data.isOnline && wasOnline) {
        ids.delete(data.userId);
        setOnlineCount((c) => Math.max(0, c - 1));
      }
    };
    socket.on("presence:update", handlePresence);
    return () => { socket.off("presence:update", handlePresence); };
  }, [socket]);

  // Listen for meeting started/ended from other ARLs
  useEffect(() => {
    if (!socket) return;
    const handleMeetingStarted = (data: { meetingId: string; title: string; hostName: string; hostId: string }) => {
      if (activeView === "broadcast") return;
      if (data.hostId === user?.id) return;
      setActiveBroadcast({ broadcastId: data.meetingId, arlName: data.hostName, title: data.title });
      // Notification popup removed per user request
      // setShowBroadcastNotification(true);
    };
    const handleMeetingEnded = (data: { meetingId: string }) => {
      if (activeBroadcast?.broadcastId === data.meetingId) {
        setShowBroadcastNotification(false);
        setActiveBroadcast(null);
        setWatchingBroadcast(false);
      }
      // Clear leftMeetingId if that meeting ended
      if (leftMeetingId === data.meetingId) {
        setLeftMeetingId(null);
      }
      // Update activeMeetings
      setActiveMeetings(prev => prev.filter(m => m.meetingId !== data.meetingId));
    };
    // Check for already-active meetings (ARL connected after meeting started)
    const handleMeetingList = (data: { meetings: Array<{ meetingId: string; hostName: string; title: string; hostId: string }> }) => {
      setActiveMeetings(data.meetings);
      if (data.meetings.length > 0 && !activeBroadcast && activeView !== "broadcast") {
        const m = data.meetings.find(m => m.hostId !== user?.id);
        if (m) {
          setActiveBroadcast({ broadcastId: m.meetingId, arlName: m.hostName, title: m.title });
          // Notification popup removed per user request
          // setShowBroadcastNotification(true);
        }
      }
      // Clear leftMeetingId if that meeting ended
      if (leftMeetingId && !data.meetings.find(m => m.meetingId === leftMeetingId)) {
        setLeftMeetingId(null);
      }
    };
    socket.on("meeting:started", handleMeetingStarted);
    socket.on("meeting:ended", handleMeetingEnded);
    socket.on("meeting:list", handleMeetingList);
    socket.emit("meeting:list");
    return () => {
      socket.off("meeting:started", handleMeetingStarted);
      socket.off("meeting:ended", handleMeetingEnded);
      socket.off("meeting:list", handleMeetingList);
    };
  }, [socket, activeView, activeBroadcast, user?.id, playTaskChime]);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const total = (data.conversations || []).reduce((s: number, c: { unreadCount: number }) => s + c.unreadCount, 0);
        setUnreadCount(total);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Instant unread count update via WebSocket + chime when not on messages view
  const activeViewRef = useRef(activeView);
  useEffect(() => { activeViewRef.current = activeView; }, [activeView]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = () => {
      fetchUnread();
      // Only chime here when Messaging component isn't mounted (it handles its own chime)
      if (activeViewRef.current !== "messages") playMessageChime();
    };
    const handler = () => fetchUnread();
    socket.on("message:new", handleNew);
    socket.on("conversation:updated", handler);
    socket.on("message:read", handler);
    return () => {
      socket.off("message:new", handleNew);
      socket.off("conversation:updated", handler);
      socket.off("message:read", handler);
    };
  }, [socket, fetchUnread, playMessageChime]);

  // Request notification permission and subscribe to push
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser doesn't support notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      // Register service worker and subscribe
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.register("/sw.js");

        try {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });

          setPushSubscription(subscription);

          // Send subscription to server
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
          });

          alert("Notifications enabled! You'll receive alerts for new messages.");
        } catch (err) {
          console.error("Push subscription failed:", err);
          alert("Failed to enable push notifications. Check console for details.");
        }
      }
    } else {
      alert("Notification permission denied. You won't receive message alerts.");
    }
  };

  // Check notification permission and existing subscription
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        // Check existing subscription
        registration.pushManager.getSubscription().then((subscription) => {
          if (subscription) {
            setPushSubscription(subscription);
          } else if (Notification.permission === "granted") {
            // Try to subscribe if permission granted but no subscription
            registration.pushManager
              .subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              })
              .then((sub) => {
                setPushSubscription(sub);
                fetch("/api/push/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(sub),
                }).catch(() => {});
              })
              .catch(() => {});
          }
        });
      });
    }
  }, []);

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-[var(--background)]">
      {/* Offline indicator banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md"
          >
            <Wifi className="h-4 w-4" />
            You&apos;re offline — some features may not work
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - always visible on desktop, drawer on mobile/tablet */}
      {/* Hide sidebar on mobile when in a meeting */}
      {isMobileOrTablet && sidebarOpen && !joiningMeeting && activeView !== "broadcast" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {!joiningMeeting && activeView !== "broadcast" && (
        <motion.aside
          className={cn(
            "z-[150] flex flex-col border-r border-border bg-card",
            isMobileOrTablet
              ? "fixed inset-y-0 left-0 w-[280px] shadow-xl"
              : "relative w-[260px] shrink-0"
          )}
          initial={isMobileOrTablet ? { x: -280 } : false}
          animate={
            isMobileOrTablet
              ? { x: sidebarOpen ? 0 : -280 }
              : { x: 0 }
          }
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)] shadow-sm">
              <span className="text-sm font-black text-white">H</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">The Hub</h1>
              <p className="text-[10px] text-muted-foreground">ARL Dashboard</p>
            </div>
          </div>
          {isMobileOrTablet && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* User info */}
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{user?.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const badge = item.id === "messages" && unreadCount > 0 ? unreadCount : 0;
            const onlineBadge = item.id === "locations" && onlineCount > 0 ? onlineCount : 0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id === "messages") setUnreadCount(0);
                  if (isMobileOrTablet) setSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-[var(--hub-red)] text-white shadow-sm shadow-red-200"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    isActive ? "bg-white text-[var(--hub-red)]" : "bg-[var(--hub-red)] text-white"
                  )}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                {onlineBadge > 0 && (
                  <span className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    isActive ? "bg-white text-emerald-600" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {onlineBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border p-3 space-y-1">
          {/* Theme and Connection - only on mobile/tablet */}
          {(device === "mobile" || device === "tablet") && (
            <div className="space-y-2 px-1 py-2">
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground">Connection</span>
                <ConnectionStatus />
              </div>
            </div>
          )}
          
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <LogOut className="h-4.5 w-4.5" />
            Sign Out
          </button>
        </div>
        </motion.aside>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar - hide on mobile when in meeting */}
        {!joiningMeeting && activeView !== "broadcast" && (
          <header className="sticky top-0 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 z-[100]">
          <div className="flex items-center gap-3">
            {isMobileOrTablet && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            )}
            <h2 className="text-base font-bold text-foreground hidden sm:block">
              {navItems.find((n) => n.id === activeView)?.label ?? ""}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <GlobalSearch onNavigate={(type, id) => {
              if (type === "task") setActiveView("tasks");
              else if (type === "message") setActiveView("messages");
              else if (type === "form") setActiveView("forms");
              else if (type === "location") setActiveView("locations");
            }} />
            <NotificationBell />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <div className="hidden sm:block">
              <ConnectionStatus />
            </div>
          </div>
          </header>
        )}

        {/* Content area */}
        <main className={cn(
          "flex-1 relative",
          activeView === "messages"
            ? "flex flex-col overflow-hidden p-5"
            : "overflow-y-auto p-5 pb-24"
        )}>
          {mounted ? (
            <>
              <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ x: swipeDirection * 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: swipeDirection * -100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                  activeView === "messages" ? "flex flex-col h-full" : "h-full"
                )}
              >
                {activeView === "overview" && <OverviewContent />}
                {activeView === "messages" && <Messaging />}
                {activeView === "tasks" && <TaskManager />}
                {activeView === "calendar" && <ArlCalendar />}
                {activeView === "locations" && <LocationsManager />}
                {activeView === "forms" && <FormsRepository />}
                {activeView === "emergency" && <EmergencyBroadcast />}
                {activeView === "users" && <UserManagement />}
                {activeView === "leaderboard" && (
                  <div className="max-w-3xl mx-auto">
                    <Leaderboard />
                  </div>
                )}
                {activeView === "remote-login" && <RemoteLogin />}
                {activeView === "data-management" && <DataManagement />}
                {activeView === "analytics" && <AnalyticsDashboard />}
                {activeView === "meetings" && (
                  <div className="space-y-6">
                    {activeMeetings.length > 0 && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                          Active Meetings
                        </h2>
                        <div className="space-y-3">
                          {activeMeetings.map((meeting) => (
                            <div
                              key={meeting.meetingId}
                              className="bg-card border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-colors shadow-sm"
                            >
                              <div>
                                <h3 className="text-foreground font-semibold">{meeting.title}</h3>
                                <p className="text-muted-foreground text-sm">Host: {meeting.hostName}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setJoiningMeeting({ meetingId: meeting.meetingId, title: meeting.title });
                                }}
                                className="bg-[var(--hub-red)] hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                              >
                                <Video className="h-4 w-4" />
                                Join
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <ScheduledMeetings onStartOnDemand={() => setActiveView("broadcast")} />
                    <div className="border-t border-border pt-6">
                      <MeetingAnalyticsDashboard />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            </>
          ) : null}
        </main>
        
        {/* Mobile page indicator - sticky at bottom like iPhone */}
        {isMobileOrTablet && mounted && (
          <PageIndicator
            pages={navItems.map(item => ({ id: item.id, label: item.label }))}
            currentPageId={activeView}
            onPageChange={handleViewChange}
            className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50"
          />
        )}
      </div>

      {/* Broadcast Studio */}
      <BroadcastStudio 
        isOpen={activeView === "broadcast"} 
        onClose={(leftMeeting?: string) => {
          setActiveView("meetings");
          // If they left (not ended) a meeting, track it for rejoin
          if (leftMeeting) {
            setLeftMeetingId(leftMeeting);
            // Refresh active meetings list
            socket?.emit("meeting:list");
          }
        }}
      />

      {/* Direct join: ARL joining an existing meeting from active meetings list */}
      {joiningMeeting && (
        <MeetingRoom
          meetingId={joiningMeeting.meetingId}
          title={joiningMeeting.title}
          isHost={false}
          onLeave={() => {
            setJoiningMeeting(null);
            socket?.emit("meeting:list");
          }}
        />
      )}

      {/* Task completion toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-card px-4 py-3 shadow-xl shadow-emerald-100"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{toast.locationName}</p>
                <p className="text-xs text-muted-foreground truncate">Completed: {toast.taskTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-bold text-amber-700">+{toast.pointsEarned}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Broadcast Notification Popup for other ARLs */}
      <AnimatePresence>
        {showBroadcastNotification && activeBroadcast && !watchingBroadcast && activeView !== "broadcast" && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-card rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 p-5 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Video className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-600 uppercase">Live Now</span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{activeBroadcast.title}</p>
                  <p className="text-xs text-muted-foreground">by {activeBroadcast.arlName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setWatchingBroadcast(true);
                    setShowBroadcastNotification(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors"
                >
                  Join Broadcast
                </button>
                <button
                  onClick={() => setShowBroadcastNotification(false)}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ARL watching another ARL's broadcast */}
      {watchingBroadcast && activeBroadcast && (
        <StreamViewer
          broadcastId={activeBroadcast.broadcastId}
          arlName={activeBroadcast.arlName}
          title={activeBroadcast.title}
          onClose={() => {
            setWatchingBroadcast(false);
            setActiveBroadcast(null);
          }}
        />
      )}

      {/* High-Five Animation */}
      <HighFiveAnimation />

      {/* Social Actions Menu */}
      <SocialActionsMenu userType="arl" userId={user?.id} userName={user?.name} />
    </div>
  );
}

function OverviewContent() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string; storeNumber: string; isOnline: boolean; lastSeen: string | null; sessionCode: string | null; currentPage: string | null }>>([]);
  const [arls, setArls] = useState<Array<{ id: string; name: string; role: string; isOnline: boolean; lastSeen: string | null; sessionCode: string | null; currentPage: string | null }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userActivities, setUserActivities] = useState<Map<string, string>>(new Map());
  const { socket } = useSocket();

  const load = useCallback(() => Promise.all([
    fetch("/api/locations").then((r) => r.ok ? r.json() : { locations: [], arls: [] }),
    fetch("/api/messages").then((r) => r.ok ? r.json() : { conversations: [] }),
  ]).then(([locData, msgData]) => {
    const locs = locData.locations || [];
    const arlsList = locData.arls || [];
    setLocations(locs);
    setArls(arlsList);
    setUnreadCount((msgData.conversations || []).reduce((s: number, c: { unreadCount: number }) => s + c.unreadCount, 0));
    
    // Initialize userActivities from currentPage in session data
    const activities = new Map<string, string>();
    locs.forEach((loc: { id: string; name: string; currentPage: string | null }) => {
      if (loc.currentPage) activities.set(loc.id, loc.currentPage);
    });
    arlsList.forEach((arl: { id: string; name: string; currentPage: string | null }) => {
      if (arl.currentPage) activities.set(arl.id, arl.currentPage);
    });
    setUserActivities(activities);
  }), []);

  useEffect(() => { load(); }, [load]);

  // Instant updates via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    socket.on("message:new", handler);
    socket.on("conversation:updated", handler);
    socket.on("task:updated", handler);
    socket.on("task:completed", handler);
    // Delta-update presence — avoid full HTTP fetch + stale sweep on every heartbeat
    const presenceHandler = (data: { userId: string; userType: string; isOnline: boolean }) => {
      if (data.userType === "location") {
        setLocations((prev) => prev.map((l) => l.id === data.userId ? { ...l, isOnline: data.isOnline } : l));
      } else {
        setArls((prev) => prev.map((a) => a.id === data.userId ? { ...a, isOnline: data.isOnline } : a));
      }
    };
    socket.on("presence:update", presenceHandler);
    // Track user activities
    const activityHandler = (data: { userId: string; page: string }) => {
      setUserActivities((prev) => new Map(prev).set(data.userId, data.page));
    };
    socket.on("activity:update", activityHandler);
    return () => {
      socket.off("presence:update", presenceHandler);
      socket.off("message:new", handler);
      socket.off("conversation:updated", handler);
      socket.off("task:updated", handler);
      socket.off("task:completed", handler);
      socket.off("activity:update", activityHandler);
    };
  }, [socket, load]);

  const onlineLocations = locations.filter((l) => l.isOnline);
  const onlineArls = arls.filter((a) => a.isOnline);

  const stats = [
    { label: "Locations Online", value: `${onlineLocations.length}/${locations.length}`, color: "bg-emerald-50 text-emerald-700", icon: Store },
    { label: "ARLs Online", value: `${onlineArls.length}/${arls.length}`, color: "bg-sky-50 text-sky-700", icon: Users },
    { label: "Unread Messages", value: String(unreadCount), color: "bg-purple-50 text-purple-700", icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-foreground">Active Sessions</h3>
          <span className="text-[10px] text-muted-foreground">{onlineLocations.length + onlineArls.length} online</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Only showing currently connected sessions</p>

        {onlineArls.length === 0 && onlineLocations.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No active sessions right now</p>
        )}

        {onlineArls.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">ARLs</p>
            <div className="space-y-2 mb-4">
              {onlineArls.map((arl) => (
                <div key={arl.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 rounded-xl bg-sky-500/10 border border-sky-500/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{arl.name}</span>
                        <span className="text-[10px] text-muted-foreground">ARL</span>
                      </div>
                      {userActivities.get(arl.id) && (
                        <span className="text-[10px] font-medium text-sky-500 truncate block">· {userActivities.get(arl.id)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {arl.sessionCode && (
                      <span className="font-mono text-xs font-bold tracking-widest text-sky-600 dark:text-sky-400 bg-sky-500/10 rounded-lg px-2 py-0.5">
                        #{arl.sessionCode}
                      </span>
                    )}
                    <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Online</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {onlineLocations.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Restaurants</p>
            <div className="space-y-2">
              {onlineLocations.map((loc) => (
                <div key={loc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{loc.name}</span>
                        <span className="text-[10px] text-muted-foreground">#{loc.storeNumber}</span>
                      </div>
                      {userActivities.get(loc.id) && (
                        <span className="text-[10px] font-medium text-emerald-500 truncate block">· {userActivities.get(loc.id)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {loc.sessionCode && (
                      <span className="font-mono text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-2 py-0.5">
                        #{loc.sessionCode}
                      </span>
                    )}
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Online</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Ticker Push */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <TickerPush />
      </div>

      {/* Shoutouts and Live Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ShoutoutsFeed />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <LiveActivityFeed maxItems={15} />
        </div>
      </div>

    </div>
  );
}

interface CalTask {
  id: string; title: string; type: string; priority: string;
  dueTime: string; dueDate: string | null; isRecurring: boolean;
  recurringType: string | null; recurringDays: string | null; locationId: string | null;
  createdAt?: string;
}

const CAL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAL_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const calTypeIcons: Record<string, typeof ClipboardList> = { task: ClipboardList, cleaning: SprayCan, reminder: Clock };

function calTaskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = CAL_DAY_KEYS[date.getDay()];
  if (!task.isRecurring) return task.dueDate === dateStr;
  // Never show a recurring task on a date before it was created
  if (task.createdAt) {
    const createdDateStr = task.createdAt.split("T")[0];
    if (dateStr < createdDateStr) return false;
  }
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") { try { return (JSON.parse(task.recurringDays!) as string[]).includes(dayKey); } catch { return false; } }
  if (rType === "biweekly") { try { const days = JSON.parse(task.recurringDays!) as string[]; if (!days.includes(dayKey)) return false; const anchorDate = (task as any).createdAt ? new Date((task as any).createdAt) : new Date(0); const anchorDay = anchorDate.getDay(); const anchorMon = new Date(anchorDate); anchorMon.setDate(anchorDate.getDate() + (anchorDay === 0 ? -6 : 1 - anchorDay)); anchorMon.setHours(0,0,0,0); const targetDay = date.getDay(); const targetMon = new Date(date); targetMon.setDate(date.getDate() + (targetDay === 0 ? -6 : 1 - targetDay)); targetMon.setHours(0,0,0,0); const weeksDiff = Math.round((targetMon.getTime() - anchorMon.getTime()) / (7 * 86400000)); const isEven = weeksDiff % 2 === 0; return (task as any).biweeklyStart === "next" ? !isEven : isEven; } catch { return false; } }
  if (rType === "monthly") { try { return (JSON.parse(task.recurringDays!) as number[]).includes(date.getDate()); } catch { return false; } }
  return false;
}

function calTime12(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }

function ArlCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; storeNumber: string }>>([]);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/tasks"), fetch("/api/locations")]).then(async ([tr, lr]) => {
      if (tr.ok) { const d = await tr.json(); setTasks(d.tasks || []); }
      if (lr.ok) { const d = await lr.json(); setLocations(d.locations || []); }
      setLoading(false);
    });
  }, []);

  const filteredTasks = filterLocationId === "all"
    ? tasks
    : tasks.filter((t) => t.locationId === null || t.locationId === filterLocationId);

  const getTasksForDate = (date: Date) =>
    filteredTasks.filter((t) => (t as any).showInCalendar !== false && calTaskApplies(t, date)).sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const monthStart = startOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(currentMonth));
  const weeks: Date[][] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  }

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Location filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-muted-foreground shrink-0">Filter by location:</label>
        <select
          value={filterLocationId}
          onChange={(e) => setFilterLocationId(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm"
        >
          <option value="all">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name} (#{l.storeNumber})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden flex-col md:flex-row">
        {/* Calendar grid */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm min-w-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <h2 className="text-sm font-bold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-border min-w-[280px]">
            {CAL_DAYS.map((d) => <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid flex-1 grid-cols-7 border-b border-border last:border-0" style={{ minHeight: 0 }}>
                {week.map((date) => {
                  const dayTasks = getTasksForDate(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const inMonth = isSameMonth(date, currentMonth);
                  return (
                    <div key={date.toISOString()} role="button" tabIndex={0}
                      onClick={() => setSelectedDate(date)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedDate(date)}
                      className={cn("flex flex-col items-start justify-start border-r border-border p-1.5 text-left transition-colors last:border-0 cursor-pointer overflow-hidden",
                        !inMonth && "bg-muted/50",
                        isSelected && "bg-[var(--hub-red)]/5 ring-1 ring-inset ring-[var(--hub-red)]/20",
                        inMonth && !isSelected && "hover:bg-muted/50"
                      )}>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        isToday(date) ? "bg-[var(--hub-red)] text-white" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                      )}>{format(date, "d")}</span>
                      <div className="mt-0.5 w-full space-y-0.5 overflow-hidden">
                        {dayTasks.slice(0, 2).map((task) => {
                          const Icon = calTypeIcons[task.type] || ClipboardList;
                          return (
                            <div key={task.id} className={cn("flex w-full items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium",
                              task.priority === "urgent" ? "bg-red-100 text-red-700" : task.priority === "high" ? "bg-orange-100 text-orange-700" :
                              task.type === "cleaning" ? "bg-purple-100 text-purple-700" : task.type === "reminder" ? "bg-sky-100 text-sky-700" : "bg-blue-100 text-blue-700"
                            )}>
                              <Icon className="h-2 w-2 shrink-0" /><span className="truncate">{task.title}</span>
                            </div>
                          );
                        })}
                        {dayTasks.length > 2 && <p className="pl-0.5 text-[9px] text-muted-foreground">+{dayTasks.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="w-full md:w-[260px] shrink-0 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">{selectedDate ? format(selectedDate, "EEE, MMM d") : "Select a day"}</h3>
            <p className="text-[10px] text-muted-foreground">{selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && <div className="flex h-20 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-[var(--hub-red)]" /></div>}
            {!loading && selectedTasks.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No tasks this day</p>}
            {selectedTasks.map((task) => {
              const Icon = calTypeIcons[task.type] || ClipboardList;
              const loc = locations.find((l) => l.id === task.locationId);
              return (
                <div key={task.id} className={cn("rounded-xl border p-3",
                  task.priority === "urgent" ? "border-red-500/20 bg-red-500/10" : task.priority === "high" ? "border-orange-500/20 bg-orange-500/10" : "border-border bg-muted/50"
                )}>
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                      task.type === "cleaning" ? "bg-purple-100 text-purple-600" : task.type === "reminder" ? "bg-sky-100 text-sky-600" : "bg-blue-100 text-blue-600"
                    )}><Icon className="h-3 w-3" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{calTime12(task.dueTime)}</span>
                        {task.isRecurring && <span className="flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />Recurring</span>}
                        <span className="text-muted-foreground">{loc ? loc.name : "All locations"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
