"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import {
  type ArlView,
  pathnameToViewId,
  viewIdToPathname,
  computeSlideDirection,
} from "@/lib/arl-views";
import { navItems } from "@/components/arl/arl-sidebar";
import { VIEW_PERMISSIONS, hasPermission } from "@/lib/permissions";
import { useSwipeNavigation, useOnlineStatus } from "@/hooks/use-mobile-utils";
import { useTheme } from "next-themes";

// ── Helper: convert VAPID public key from base64url to Uint8Array ──
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

// ── Device type detection hook ──
export type DeviceType = "desktop" | "tablet" | "mobile";

export function useDeviceType(): DeviceType {
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

// ── Interfaces ──

export interface TaskToast {
  id: string;
  locationName: string;
  taskTitle: string;
  pointsEarned: number;
}

export interface ActiveMeeting {
  meetingId: string;
  title: string;
  hostName: string;
  hostId: string;
}

export interface ActiveBroadcast {
  broadcastId: string;
  arlName: string;
  title: string;
}

export interface ArlDashboardContextValue {
  // Navigation
  activeView: ArlView;
  navigateToView: (view: ArlView) => void;
  swipeDirection: 1 | -1;

  // Counts & badges
  unreadCount: number;
  onlineCount: number;

  // Meeting state
  activeMeetings: ActiveMeeting[];
  joiningMeeting: { meetingId: string; title: string } | null;
  setJoiningMeeting: (m: { meetingId: string; title: string } | null) => void;
  leftMeetingId: string | null;
  setLeftMeetingId: (id: string | null) => void;

  // Broadcast state
  activeBroadcast: ActiveBroadcast | null;
  setActiveBroadcast: (b: ActiveBroadcast | null) => void;
  watchingBroadcast: boolean;
  setWatchingBroadcast: (v: boolean) => void;
  showBroadcastNotification: boolean;
  setShowBroadcastNotification: (v: boolean) => void;

  // Notifications
  notificationPermission: NotificationPermission;
  pushSubscription: PushSubscription | null;
  requestNotificationPermission: () => Promise<void>;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  isMobileOrTablet: boolean;
  device: DeviceType;

  // Theme
  cycleTheme: () => void;

  // Session
  sessionCode: string | null;
  sessionCount: number;

  // Toasts
  toasts: TaskToast[];
  notifToast: { msg: string; type: "success" | "error" } | null;
}

const ArlDashboardContext = createContext<ArlDashboardContextValue | null>(null);

// ── Pure helpers (exported for testing) ──

/**
 * Apply a presence update event to the online set.
 * Returns the (mutated) set for convenience.
 */
export function applyPresenceUpdate(
  onlineSet: Set<string>,
  event: { userId: string; userType: string; isOnline: boolean },
): Set<string> {
  if (event.userType !== "location") return onlineSet;
  if (event.isOnline) {
    onlineSet.add(event.userId);
  } else {
    onlineSet.delete(event.userId);
  }
  return onlineSet;
}

/**
 * Create a task toast from a socket event payload.
 */
export function createTaskToast(
  payload: { locationId: string; taskId: string; taskTitle: string; pointsEarned: number },
  locationNames: Map<string, string>,
): TaskToast {
  return {
    id: `${payload.taskId}-${Date.now()}`,
    locationName: locationNames.get(payload.locationId) || "A location",
    taskTitle: payload.taskTitle,
    pointsEarned: payload.pointsEarned,
  };
}

// ── Provider ──

export function ArlDashboardProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, isConnected: socketConnected, updateActivity } = useSocket();
  const { theme, setTheme } = useTheme();
  const device = useDeviceType();
  const isOnline = useOnlineStatus();

  // ── Navigation ──
  const activeView = pathnameToViewId(pathname);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const prevViewRef = useRef<ArlView>(activeView);

  // Track direction when pathname changes
  useEffect(() => {
    if (prevViewRef.current !== activeView) {
      setSwipeDirection(computeSlideDirection(prevViewRef.current, activeView, navItems));
      prevViewRef.current = activeView;
    }
  }, [activeView]);

  const navigateToView = useCallback(
    (view: ArlView) => {
      setSwipeDirection(computeSlideDirection(activeView, view, navItems));
      router.push(viewIdToPathname(view));
    },
    [activeView, router],
  );

  // ── Swipe navigation ──
  const isMobileOrTablet = device === "mobile" || device === "tablet";
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth < 1024) {
      return true;
    }
    return false;
  });

  const swipeViewIds = navItems.map((n) => n.id as string);
  const handleSwipeViewChange = useCallback(
    (newView: string) => {
      navigateToView(newView as ArlView);
    },
    [navigateToView],
  );
  useSwipeNavigation(swipeViewIds, activeView as string, handleSwipeViewChange, isMobileOrTablet && !sidebarOpen);

  // ── Activity tracking ──
  useEffect(() => {
    updateActivity(activeView);
  }, [activeView, updateActivity]);

  // ── Counts ──
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const onlineLocationIdsRef = useRef<Set<string>>(new Set());
  const locationNamesRef = useRef<Map<string, string>>(new Map());

  // ── Meeting state ──
  const [activeMeetings, setActiveMeetings] = useState<ActiveMeeting[]>([]);
  const [joiningMeeting, setJoiningMeeting] = useState<{ meetingId: string; title: string } | null>(null);
  const [leftMeetingId, setLeftMeetingId] = useState<string | null>(null);

  // ── Broadcast state ──
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcast | null>(null);
  const [showBroadcastNotification, setShowBroadcastNotification] = useState(false);
  const [watchingBroadcast, setWatchingBroadcast] = useState(false);

  // ── Notification state ──
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);

  // ── Toast state ──
  const [toasts, setToasts] = useState<TaskToast[]>([]);
  const [notifToast, setNotifToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Theme ──
  const cycleTheme = useCallback(() => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }, [theme, setTheme]);

  // ── Session ──
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  // ── Audio refs ──
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Audio chimes ──
  const playMessageChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      ([[660, 0, 0.12], [880, 0.15, 0.18]] as [number, number, number][]).forEach(([freq, delay, dur]) => {
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

  const playTaskChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      ([[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.12], [1047, 0.26, 0.2]] as [number, number, number][]).forEach(([freq, delay, dur]) => {
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

  // ── Notification toast helper ──
  const showNotifToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setNotifToast({ msg, type });
    setTimeout(() => setNotifToast(null), 4000);
  }, []);

  // ── Fetch initial online count + cache location names ──
  const fetchOnlineCount = useCallback(() => {
    fetch("/api/locations")
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          const locs: any[] = d.locations || [];
          const arls: any[] = d.arls || [];
          const onlineLocs = locs.filter((l: any) => l.isOnline);
          onlineLocationIdsRef.current = new Set(onlineLocs.map((l: any) => l.id));
          setOnlineCount(onlineLocs.length);
          const map = new Map<string, string>();
          for (const l of locs) map.set(l.id, l.name);
          for (const a of arls) map.set(a.id, a.name);
          locationNamesRef.current = map;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOnlineCount();
  }, [fetchOnlineCount]);

  // ── Fetch initial unread count ──
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const total = (data.conversations || []).reduce(
          (s: number, c: { unreadCount: number }) => s + c.unreadCount,
          0,
        );
        setUnreadCount(total);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // ── Fetch session code ──
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/session/code", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setSessionCode(data.sessionCode || null);
          setSessionCount(data.sessions?.length || 0);
        }
      } catch {}
    };
    fetchSession();
  }, [socketConnected]);

  // ── Socket: task:completed → toast + chime ──
  useEffect(() => {
    if (!socket) return;
    const handleTaskCompleted = (data: {
      locationId: string;
      taskId: string;
      taskTitle: string;
      pointsEarned: number;
    }) => {
      const toast = createTaskToast(data, locationNamesRef.current);
      setToasts((prev) => [...prev, toast]);
      playTaskChime();
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };
    socket.on("task:completed", handleTaskCompleted);
    return () => {
      socket.off("task:completed", handleTaskCompleted);
    };
  }, [socket, playTaskChime]);

  // ── Socket: presence:update → delta-update online count ──
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
    return () => {
      socket.off("presence:update", handlePresence);
    };
  }, [socket]);

  // ── Socket: meeting events ──
  useEffect(() => {
    if (!socket) return;
    const handleMeetingStarted = (data: {
      meetingId: string;
      title: string;
      hostName: string;
      hostId: string;
    }) => {
      if (activeView === "broadcast") return;
      if (data.hostId === user?.id) return;
      setActiveBroadcast({
        broadcastId: data.meetingId,
        arlName: data.hostName,
        title: data.title,
      });
    };
    const handleMeetingEnded = (data: { meetingId: string }) => {
      setActiveBroadcast((prev) => {
        if (prev?.broadcastId === data.meetingId) {
          setShowBroadcastNotification(false);
          setWatchingBroadcast(false);
          return null;
        }
        return prev;
      });
      setLeftMeetingId((prev) => (prev === data.meetingId ? null : prev));
      setActiveMeetings((prev) => prev.filter((m) => m.meetingId !== data.meetingId));
    };
    const handleMeetingList = (data: {
      meetings: Array<{ meetingId: string; hostName: string; title: string; hostId: string }>;
    }) => {
      setActiveMeetings(data.meetings);
      if (data.meetings.length > 0 && activeView !== "broadcast") {
        setActiveBroadcast((prev) => {
          if (prev) return prev;
          const m = data.meetings.find((mt) => mt.hostId !== user?.id);
          if (m) {
            return { broadcastId: m.meetingId, arlName: m.hostName, title: m.title };
          }
          return prev;
        });
      }
      setLeftMeetingId((prev) => {
        if (prev && !data.meetings.find((m) => m.meetingId === prev)) return null;
        return prev;
      });
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
  }, [socket, activeView, user?.id]);

  // ── Socket: message events → unread count + chime ──
  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = () => {
      fetchUnread();
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

  // ── Notification permission + push subscription ──
  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      showNotifToast("This browser doesn't support notifications", "error");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.register("/sw.js");
        try {
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) {
            console.error("VAPID public key not configured");
            showNotifToast("Push notifications not configured. Contact your admin.", "error");
            return;
          }
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
          setPushSubscription(subscription);
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
          });
          showNotifToast("Notifications enabled! You'll receive alerts for new messages.");
        } catch (err) {
          console.error("Push subscription failed:", err);
          showNotifToast("Failed to enable push notifications.", "error");
        }
      }
    } else {
      showNotifToast("Notification permission denied. You won't receive message alerts.", "error");
    }
  }, [showNotifToast]);

  // Check notification permission and existing subscription on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          if (subscription) {
            setPushSubscription(subscription);
          } else if (Notification.permission === "granted") {
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) return;
            registration.pushManager
              .subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
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

  // ── Permission-based route guard ──
  useEffect(() => {
    const viewId = pathnameToViewId(pathname);
    const requiredPerm = VIEW_PERMISSIONS[viewId];
    if (
      requiredPerm &&
      !hasPermission(user?.role, (user?.permissions as any) ?? null, requiredPerm)
    ) {
      router.replace("/arl");
    }
  }, [pathname, user, router]);

  // ── Context value ──
  const value: ArlDashboardContextValue = {
    activeView,
    navigateToView,
    swipeDirection,
    unreadCount,
    onlineCount,
    activeMeetings,
    joiningMeeting,
    setJoiningMeeting,
    leftMeetingId,
    setLeftMeetingId,
    activeBroadcast,
    setActiveBroadcast,
    watchingBroadcast,
    setWatchingBroadcast,
    showBroadcastNotification,
    setShowBroadcastNotification,
    notificationPermission,
    pushSubscription,
    requestNotificationPermission,
    sidebarOpen,
    setSidebarOpen,
    isMobileOrTablet,
    device,
    cycleTheme,
    sessionCode,
    sessionCount,
    toasts,
    notifToast,
  };

  return (
    <ArlDashboardContext.Provider value={value}>
      {children}
    </ArlDashboardContext.Provider>
  );
}

// ── Hook ──

export function useArlDashboard() {
  const ctx = useContext(ArlDashboardContext);
  if (!ctx) {
    throw new Error("useArlDashboard must be used within ArlDashboardProvider");
  }
  return ctx;
}
