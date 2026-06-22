"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { Loader2, LogOut, Sun, Moon, Monitor } from "@/lib/icons";
import { useTheme } from "next-themes";
import { useGrid } from "@/components/dashboard/grid";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { ConnectionStatus } from "@/components/connection-status";
import { OfflineIndicator } from "@/components/offline-indicator";
import { EmergencyOverlay } from "@/components/dashboard/emergency-overlay";
import { StreamViewer } from "@/components/dashboard/stream-viewer";
import { RemoteViewBanner } from "@/components/dashboard/remote-view-banner";
import { ArlCursorOverlay } from "@/components/dashboard/arl-cursor-overlay";
import { CursorOverlay } from "@/components/remote/cursor-overlay";
import { MirrorToolbar } from "@/components/remote/mirror-toolbar";
import { MirrorProvider, useMirror } from "@/lib/mirror-context";
import { playTaskSound } from "@/lib/sound-effects";
import type { RemoteCaptureManager } from "@/lib/remote-capture";
import type { TaskItem } from "@/components/dashboard/timeline";
import { useSearchParams } from "next/navigation";
import {
  GridProvider,
  SettingsPanel,
  GridSurface,
  GridSync,
  GridMirrorSync,
  getPredefinedLayout,
  DEFAULT_LAYOUT_ID,
  type GridLayout,
  type WidgetData,
  type UpcomingTask,
} from "@/components/dashboard/grid";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

interface TasksResponse {
  tasks: TaskItem[];
  missedYesterday: TaskItem[];
}

function localParams(mirrorLocationId?: string | null) {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const localDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  let query = `localDate=${localDate}&localTime=${localTime}&localDay=${localDay}`;
  if (mirrorLocationId) query += `&locationId=${mirrorLocationId}`;
  return { localDate, localTime, query };
}

// ── Header clock — isolated so the 1s tick only re-renders this component ──
function HeaderClockDisplay() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  return (
    <span className="font-mono text-base font-semibold tabular-nums text-foreground" aria-label="Current time">
      {time}
    </span>
  );
}

// Hides the header clock pill when the Clock widget is on the grid
function HeaderClock() {
  const { widgets } = useGrid();
  const hasClockWidget = widgets.some((w) => w.type === "clock");
  if (hasClockWidget) return null;
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 100, damping: 30 }}
      className="flex h-9 items-center rounded-full bg-card/80 px-4 shadow-sm"
    >
      <HeaderClockDisplay />
    </motion.div>
  );
}

// ── Grid Ticker ──────────────────────────────────────────────────────────────

interface TickerItem { id: string; text: string; icon: string; timestamp: number; }
const MAX_TICKER_ITEMS = 20;
const TICKER_SPEED_PX = 65;

function GridTickerBar({ currentLocationId }: { currentLocationId?: string }) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const { socket } = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/ticker")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        const arlItems: TickerItem[] = (data.messages || []).map(
          (m: { id: string; icon: string; content: string; arlName: string; createdAt: string }) => ({
            id: `arl-${m.id}`, text: `${m.content} — ${m.arlName}`,
            icon: m.icon, timestamp: new Date(m.createdAt).getTime(),
          }),
        );
        if (arlItems.length > 0) setItems(arlItems.slice(0, MAX_TICKER_ITEMS));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const add = (item: TickerItem) => setItems((prev) => [item, ...prev].slice(0, MAX_TICKER_ITEMS));
    const onTaskCompleted = (d: { locationId?: string; locationName?: string; taskTitle?: string; taskId?: string }) => {
      if (currentLocationId && d.locationId === currentLocationId) return;
      add({ id: `task-${d.taskId}-${Date.now()}`, text: `${d.locationName || "A location"} completed "${d.taskTitle}"`, icon: "✅", timestamp: Date.now() });
    };
    const onTaskUncompleted = (d: { taskId?: string }) => {
      if (d.taskId) setItems((prev) => prev.filter((i) => !i.id.startsWith(`task-${d.taskId}-`)));
    };
    const onTickerNew = (d: { id: string; icon: string; content: string; arlName: string }) => {
      add({ id: `arl-${d.id}`, text: `${d.content} — ${d.arlName}`, icon: d.icon, timestamp: Date.now() });
    };
    const onTickerDelete = (d: { id: string }) => setItems((prev) => prev.filter((i) => i.id !== `arl-${d.id}`));
    socket.on("task:completed", onTaskCompleted);
    socket.on("task:uncompleted", onTaskUncompleted);
    socket.on("ticker:new", onTickerNew);
    socket.on("ticker:delete", onTickerDelete);
    return () => {
      socket.off("task:completed", onTaskCompleted);
      socket.off("task:uncompleted", onTaskUncompleted);
      socket.off("ticker:new", onTickerNew);
      socket.off("ticker:delete", onTickerDelete);
    };
  }, [socket, currentLocationId]);

  const fmt = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const hasItems = items.length > 0;
  const tickerText = hasItems ? items.map((i) => `${i.icon}  ${i.text}  ·  ${fmt(i.timestamp)}`).join("          ") : "";

  useEffect(() => {
    if (!hasItems) return;
    if (posRef.current === null) posRef.current = 0;
    let last = performance.now();
    let running = true;
    const tick = (now: number) => {
      if (!running) return;
      const dt = (now - last) / 1000; last = now;
      const container = containerRef.current; const span = spanRef.current;
      if (container && span) {
        const cw = container.clientWidth; const sw = span.offsetWidth;
        if (posRef.current === null || posRef.current === 0) posRef.current = cw;
        posRef.current -= TICKER_SPEED_PX * dt;
        if (posRef.current < -sw) posRef.current = cw;
        span.style.transform = `translateX(${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); posRef.current = null; };
  }, [hasItems]);

  return (
    <AnimatePresence initial={false}>
      {hasItems && (
        <motion.div key="ticker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="mx-3 mb-3 flex h-9 shrink-0 items-center overflow-hidden rounded-full bg-card/80 shadow-sm"
        >
          <div className="flex h-full shrink-0 items-center gap-1.5 rounded-l-full bg-primary px-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground">Live</span>
          </div>
          <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden" style={{ height: "100%" }}>
            <span ref={spanRef} className="absolute inset-y-0 flex items-center whitespace-nowrap text-xs font-medium text-foreground/80"
              style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", transform: "translateX(9999px)" }}>
              {tickerText}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Top-level export: wraps in MirrorProvider + Suspense, routes mirror vs normal ──
export default function GridDashboardPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MirrorProvider>
        <GridDashboardRouter />
      </MirrorProvider>
    </Suspense>
  );
}

function GridDashboardRouter() {
  const searchParams = useSearchParams();
  const mirrorLocationId = searchParams.get("mirror");
  const mirrorSessionId = searchParams.get("session");
  const isEmbed = searchParams.get("embed") === "true";

  // Mirror shell: ARL side — renders toolbar + scaled iframe
  if (mirrorLocationId && mirrorSessionId && !isEmbed) {
    return <GridMirrorShell />;
  }

  return <GridDashboardPage />;
}

// ── Mirror shell (ARL side) ──────────────────────────────────────────────────
function GridMirrorShell() {
  const searchParams = useSearchParams();
  const mirrorLocationId = searchParams.get("mirror")!;
  const mirrorSessionId = searchParams.get("session")!;
  const mirrorLocationName = searchParams.get("locationName") || mirrorLocationId;
  const { isMirroring, startMirror, targetDevice, targetLocationName, cursorVisible, controlEnabled, setDisableCursorTracking } = useMirror();
  const { user } = useAuth();

  useEffect(() => {
    if (!isMirroring && mirrorLocationId && mirrorSessionId) {
      startMirror(mirrorLocationId, mirrorLocationName, mirrorSessionId);
    }
  }, [mirrorLocationId, mirrorSessionId, mirrorLocationName, isMirroring, startMirror]);

  // Disable window-level cursor tracking — the embed iframe handles it
  useEffect(() => {
    setDisableCursorTracking(true);
    return () => setDisableCursorTracking(false);
  }, [setDisableCursorTracking]);

  const iframeUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("embed", "true");
    return `/dashboard?${params.toString()}`;
  }, [searchParams]);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ width: r.width, height: r.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const scale = targetDevice && containerSize.width > 0
    ? Math.min(containerSize.width / targetDevice.width, containerSize.height / targetDevice.height, 1)
    : 1;

  // Forward cursor visibility to the embed iframe via postMessage
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "mirror:cursor-visible", visible: cursorVisible, arlName: user?.name || "Admin" },
      window.location.origin,
    );
  }, [cursorVisible, user?.name]);

  return (
    <>
      <MirrorToolbar />
      <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-black flex items-start justify-center pt-14">
        {targetDevice ? (
          <div className="shrink-0" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              width={targetDevice.width}
              height={targetDevice.height}
              className="border-0 rounded-lg shadow-2xl"
              style={controlEnabled ? undefined : { pointerEvents: "none" }}
              title={`Mirror: ${targetLocationName || mirrorLocationName}`}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Connecting to {mirrorLocationName}...</p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main grid dashboard page ─────────────────────────────────────────────────
function GridDashboardPage() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();

  // ── Mirror detection ──
  const searchParams = useSearchParams();
  const mirrorLocationId = searchParams.get("mirror");
  const mirrorSessionId = searchParams.get("session");
  const mirrorLocationName = searchParams.get("locationName") || mirrorLocationId || "";
  const isEmbed = searchParams.get("embed") === "true";
  const { isMirroring, startMirror, viewState: mirrorViewState, sendViewChange, remoteScroll, sessionId: mirrorSession } = useMirror();

  useEffect(() => {
    if (mirrorLocationId && mirrorSessionId && !isMirroring) {
      startMirror(mirrorLocationId, mirrorLocationName, mirrorSessionId);
    }
  }, [mirrorLocationId, mirrorSessionId, mirrorLocationName, isMirroring, startMirror]);

  // ── Remote view state ──
  const [remoteViewActive, setRemoteViewActive] = useState(false);
  const captureManagerRef = useRef<RemoteCaptureManager | null>(null);

  // ── Sound system ──
  const [soundEnabled, setSoundEnabled] = useState(true);
  useEffect(() => {
    fetch("/api/locations/sound")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSoundEnabled(!d.muted); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { muted: boolean }) => setSoundEnabled(!data.muted);
    socket.on("location:sound-toggle", handler);
    return () => { socket.off("location:sound-toggle", handler); };
  }, [socket]);

  // ── Data ──
  const [data, setData] = useState<TasksResponse | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Record<string, UpcomingTask[]>>({});
  const [chatUnread, setChatUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);
  const [formsOpen, setFormsOpen] = useState(false);
  const [initialLayout, setInitialLayout] = useState<GridLayout | null>(null);

  // ── Stream viewer ──
  const [activeStream, setActiveStream] = useState<{ broadcastId: string; meetingId: string; arlName: string; title: string } | null>(null);

  const deviceIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  );

  // ── Midnight day-reset ────────────────────────────────────────────────────
  // Tracks date string; on rollover emits client:day-reset so the server
  // reschedules timers. fetchTasks is called immediately as a local fallback.
  const currentDateRef = useRef<string>("");
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (currentDateRef.current && currentDateRef.current !== dateStr) {
        socket?.emit("client:day-reset");
        fetchTasks();
      }
      currentDateRef.current = dateStr;
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]); // fetchTasks added below after definition

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const { query } = localParams(mirrorLocationId);
      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`/api/tasks/today?${query}`),
        fetch(`/api/tasks/upcoming?${query}`),
      ]);
      if (todayRes.ok) setData(await todayRes.json());
      if (upcomingRes.ok) {
        const json = await upcomingRes.json();
        setUpcomingTasks(json.upcoming || {});
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }, [mirrorLocationId]);

  const fetchChatUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const json = await res.json();
        const total = (json.conversations || []).reduce(
          (sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount || 0), 0,
        );
        setChatUnread(total);
      }
    } catch { /* non-fatal */ }
  }, []);

  // Load persisted grid layout
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let resolved: GridLayout | null = null;
      try {
        const res = await fetch("/api/preferences/grid-layout");
        if (res.ok) {
          const json = await res.json();
          if (json?.layout && Array.isArray(json.layout.widgets)) resolved = json.layout as GridLayout;
        }
      } catch { /* fall back to default */ }
      if (!cancelled) setInitialLayout(resolved ?? getPredefinedLayout(DEFAULT_LAYOUT_ID)!);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchTasks();
    fetchChatUnread();
  }, [user, fetchTasks, fetchChatUnread]);

  // Real-time socket refresh
  useEffect(() => {
    if (!socket) return;
    const onTask = () => fetchTasks();
    const onMsg = () => fetchChatUnread();
    const onBroadcastStarted = (d: { broadcastId: string; meetingId: string; arlName: string; title: string }) => {
      setActiveStream({ broadcastId: d.broadcastId, meetingId: d.meetingId, arlName: d.arlName, title: d.title });
      socket.emit("broadcast:viewer-joined", { broadcastId: d.broadcastId });
    };
    const onBroadcastEnded = (d: { broadcastId: string }) => {
      setActiveStream((prev) => (prev?.broadcastId === d.broadcastId ? null : prev));
    };
    socket.on("task:completed", onTask);
    socket.on("task:updated", onTask);
    socket.on("message:new", onMsg);
    socket.on("message:read", onMsg);
    socket.on("broadcast:started", onBroadcastStarted);
    socket.on("broadcast:ended", onBroadcastEnded);
    return () => {
      socket.off("task:completed", onTask);
      socket.off("task:updated", onTask);
      socket.off("message:new", onMsg);
      socket.off("message:read", onMsg);
      socket.off("broadcast:started", onBroadcastStarted);
      socket.off("broadcast:ended", onBroadcastEnded);
    };
  }, [socket, fetchTasks, fetchChatUnread]);

  // ── Task handlers ─────────────────────────────────────────────────────────
  const handleComplete = useCallback(async (taskId: string) => {
    const { localDate } = localParams(mirrorLocationId);
    setData((prev) => prev ? {
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, isCompleted: true, isOverdue: false, isDueSoon: false } : t,
      ),
    } : prev);
    try {
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
        const task = data?.tasks.find((t) => t.id === taskId);
        if (soundEnabled && task) playTaskSound(task.type as Parameters<typeof playTaskSound>[0]);
        await fetchTasks();
      } else {
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
      await fetchTasks();
    }
  }, [fetchTasks, mirrorLocationId, mirrorLocationName, soundEnabled, data]);

  const handleUncomplete = useCallback(async (taskId: string) => {
    const { localDate } = localParams(mirrorLocationId);
    try {
      await fetch("/api/tasks/uncomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          localDate,
          ...(mirrorLocationId ? { mirrorLocationId } : {}),
        }),
      });
      await fetchTasks();
    } catch (err) {
      console.error("Failed to uncomplete task:", err);
    }
  }, [fetchTasks, mirrorLocationId]);

  const handleEarlyComplete = useCallback(async (taskId: string, dateStr: string) => {
    try {
      await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          localDate: dateStr,
          ...(mirrorLocationId ? { mirrorLocationId, mirrorLocationName } : {}),
        }),
      });
      await fetchTasks();
    } catch (err) {
      console.error("Failed to early-complete task:", err);
    }
  }, [fetchTasks, mirrorLocationId, mirrorLocationName]);

  const handleEarlyUncomplete = useCallback(async (taskId: string, dateStr: string) => {
    try {
      await fetch("/api/tasks/uncomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, localDate: dateStr }),
      });
      await fetchTasks();
    } catch (err) {
      console.error("Failed to early-uncomplete task:", err);
    }
  }, [fetchTasks]);

  // ── Save grid layout ──────────────────────────────────────────────────────
  const saveLayout = useCallback(async (layout: GridLayout) => {
    const res = await fetch("/api/preferences/grid-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: layout.isCustom ? layout : null, deviceId: deviceIdRef.current }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  }, []);

  // ── Mirror: sync view state from target → ARL ─────────────────────────────
  const mirrorSyncingRef = useRef(false);
  const { theme: currentTheme, setTheme } = useTheme();
  useEffect(() => {
    if (!isMirroring || !mirrorViewState) return;
    mirrorSyncingRef.current = true;
    setChatOpen(mirrorViewState.chatOpen);
    if (mirrorViewState.chatThreadId !== undefined) setChatThreadId(mirrorViewState.chatThreadId ?? null);
    setFormsOpen(mirrorViewState.formsOpen);
    if (mirrorViewState.soundEnabled !== undefined) setSoundEnabled(mirrorViewState.soundEnabled);
    if (mirrorViewState.theme) setTheme(mirrorViewState.theme);
    requestAnimationFrame(() => { mirrorSyncingRef.current = false; });
  }, [isMirroring, mirrorViewState, setTheme]);

  // ── Mirror: send ARL local changes back to target ─────────────────────────
  useEffect(() => {
    if (!isMirroring || mirrorSyncingRef.current) return;
    sendViewChange({ chatOpen, formsOpen, chatThreadId, soundEnabled });
  }, [isMirroring, chatOpen, formsOpen, chatThreadId, soundEnabled, sendViewChange]);

  // ── Mirror: receive reverse view changes from ARL → target ────────────────
  const { socket: viewSyncSocket } = useSocket();
  useEffect(() => {
    if (isMirroring || !remoteViewActive || !viewSyncSocket) return;
    const onReverseView = (d: { sessionId: string; viewState: Record<string, unknown> }) => {
      const vs = d.viewState;
      if (vs.chatOpen !== undefined) setChatOpen(vs.chatOpen as boolean);
      if (vs.chatThreadId !== undefined) setChatThreadId(vs.chatThreadId as string | null);
      if (vs.formsOpen !== undefined) setFormsOpen(vs.formsOpen as boolean);
      if (vs.connectionOpen !== undefined) {
        window.dispatchEvent(new CustomEvent("mirror:panel-sync", { detail: { connectionOpen: vs.connectionOpen } }));
      }
    };
    viewSyncSocket.on("mirror:view-change", onReverseView);
    return () => { viewSyncSocket.off("mirror:view-change", onReverseView); };
  }, [isMirroring, remoteViewActive, viewSyncSocket]);

  // ── Mirror embed: ARL cursor tracking ────────────────────────────────────
  const { socket: scrollSocket } = useSocket();
  const arlCursorVisibleRef = useRef(false);
  useEffect(() => {
    if (!isEmbed || !isMirroring) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "mirror:cursor-visible") arlCursorVisibleRef.current = e.data.visible;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isEmbed, isMirroring]);

  useEffect(() => {
    if (!isEmbed || !isMirroring || !scrollSocket || !mirrorSession) return;
    let lastTime = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (!arlCursorVisibleRef.current) return;
      const now = Date.now();
      if (now - lastTime < 33) return;
      lastTime = now;
      scrollSocket.volatile.emit("mirror:arl-cursor", {
        sessionId: mirrorSession,
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        visible: true,
      });
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [isEmbed, isMirroring, scrollSocket, mirrorSession]);

  // ── Mirror: scroll sync target → ARL embed ────────────────────────────────
  const scrollSyncingRef = useRef(false);
  useEffect(() => {
    if (!isMirroring || !isEmbed || !remoteScroll) return;
    scrollSyncingRef.current = true;
    // Grid dashboard doesn't use a data-scroll-sync container — scroll the window
    window.scrollTo(remoteScroll.x, remoteScroll.y);
    requestAnimationFrame(() => { scrollSyncingRef.current = false; });
  }, [isMirroring, isEmbed, remoteScroll]);

  // ── Broadcast view state when being remote-viewed ─────────────────────────
  useEffect(() => {
    if (!remoteViewActive || !captureManagerRef.current) return;
    captureManagerRef.current.broadcastViewState({
      chatOpen, formsOpen, chatThreadId, soundEnabled, theme: currentTheme,
    });
  }, [chatOpen, formsOpen, chatThreadId, soundEnabled, currentTheme, remoteViewActive]);

  // Relay connection data to mirror
  useEffect(() => {
    if (!remoteViewActive) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (captureManagerRef.current && detail) captureManagerRef.current.broadcastViewState(detail);
    };
    window.addEventListener("mirror:connection-data", handler);
    return () => window.removeEventListener("mirror:connection-data", handler);
  }, [remoteViewActive]);

  // Embed mode: relay panel-change DOM events via sendViewChange
  useEffect(() => {
    if (!isEmbed || !isMirroring) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) sendViewChange(detail);
    };
    window.addEventListener("mirror:panel-change", handler);
    return () => window.removeEventListener("mirror:panel-change", handler);
  }, [isEmbed, isMirroring, sendViewChange]);

  // ── Chat / forms openers ──────────────────────────────────────────────────
  const openChat = useCallback((conversationId?: string) => {
    setChatThreadId(conversationId ?? null);
    setChatOpen(true);
  }, []);
  const openForms = useCallback(() => setFormsOpen(true), []);

  // ── Widget data bundle ────────────────────────────────────────────────────
  const widgetData = useMemo<WidgetData>(() => ({
    tasks: data?.tasks ?? [],
    onComplete: handleComplete,
    onUncomplete: handleUncomplete,
    upcomingTasks,
    onEarlyComplete: handleEarlyComplete,
    onEarlyUncomplete: handleEarlyUncomplete,
    missedYesterday: data?.missedYesterday ?? [],
    chatUnread,
    onOpenChat: openChat,
    onOpenForms: openForms,
  }), [data, upcomingTasks, chatUnread, handleComplete, handleUncomplete, handleEarlyComplete, handleEarlyUncomplete, openChat, openForms]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { theme } = useTheme();
  const cycleTheme = useCallback(() => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }, [theme, setTheme]);
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);

  if (!user || !initialLayout) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentLocationId = user.userType === "location" ? user.locationId || user.id : undefined;
  // In mirror mode, scope location-specific components to the target
  const effectiveLocationId = mirrorLocationId || currentLocationId;

  // ── Render ────────────────────────────────────────────────────────────────
  const dashboardContent = (
    <GridProvider initialLayout={initialLayout}>
      <GridSync socket={socket} deviceId={deviceIdRef.current} />
      {/* Layout sync for remote-view / mirror: broadcasts target's layout to embed, applies it in embed */}
      <GridMirrorSync
        isEmbed={isEmbed}
        isMirroring={isMirroring}
        remoteViewActive={remoteViewActive}
        mirrorViewState={mirrorViewState}
        captureManagerRef={captureManagerRef}
      />
      <div className="flex h-screen flex-col bg-background">
        <LayoutGroup id="grid-header">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
            <motion.div layout transition={{ type: "spring", stiffness: 100, damping: 30 }}
              className="glass-pill flex h-9 flex-1 items-center gap-2.5 rounded-full px-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                <span className="text-xs font-black text-primary-foreground">H</span>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-foreground leading-none">Dashboard</p>
                {user.name && <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{user.name}</p>}
              </div>
            </motion.div>
            <div className="flex items-center gap-2">
              <motion.div layout transition={{ type: "spring", stiffness: 100, damping: 30 }} className="flex items-center gap-2">
                <HeaderClock />
                <SettingsPanel onSave={saveLayout} theme={theme} themeMounted={themeMounted} onCycleTheme={cycleTheme} />
              </motion.div>
              <ConnectionStatus />
              <button type="button" onClick={() => logout()}
                className="glass-pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </header>
        </LayoutGroup>

        <motion.div layout className="min-h-0 flex-1">
          <GridSurface data={widgetData} />
        </motion.div>

        {/* Ticker — hidden during remote view to reduce capture noise */}
        {!remoteViewActive && !isMirroring && (
          <GridTickerBar currentLocationId={effectiveLocationId} />
        )}

        <RestaurantChat
          isOpen={chatOpen}
          onClose={() => { setChatOpen(false); setChatThreadId(null); }}
          unreadCount={chatUnread}
          onUnreadChange={setChatUnread}
          currentUserId={user.id}
          chatThreadId={chatThreadId}
          startFullscreen
        />
        {formsOpen && <FormsViewer onClose={() => setFormsOpen(false)} />}

        {/* Emergency overlay — safety critical, always present */}
        <EmergencyOverlay />

        {/* Live broadcast — auto-opens when ARL starts a meeting */}
        {activeStream && (
          <StreamViewer
            broadcastId={activeStream.meetingId}
            arlName={activeStream.arlName}
            title={activeStream.title}
            onClose={() => {
              socket?.emit("broadcast:viewer-left", { broadcastId: activeStream.broadcastId });
              setActiveStream(null);
            }}
          />
        )}

        {/* Remote view — skip in mirror mode */}
        {!isMirroring && (
          <RemoteViewBanner
            onSessionChange={setRemoteViewActive}
            onCaptureManagerChange={(m) => { captureManagerRef.current = m; }}
          />
        )}
        <ArlCursorOverlay remoteViewActive={remoteViewActive} />

        <div className="fixed bottom-4 left-4 z-50">
          <OfflineIndicator />
        </div>
      </div>
    </GridProvider>
  );

  // Embed mode (inside mirror iframe): add cursor overlay
  if (isMirroring && isEmbed) {
    return (
      <>
        <CursorOverlay />
        {dashboardContent}
      </>
    );
  }

  return dashboardContent;
}
