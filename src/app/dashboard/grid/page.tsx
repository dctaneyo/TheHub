"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { Loader2, LogOut, Sun, Moon, Monitor } from "@/lib/icons";
import { useTheme } from "next-themes";
import { useGrid } from "@/components/dashboard/grid";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { ConnectionStatus } from "@/components/connection-status";
import { OfflineIndicator } from "@/components/offline-indicator";
import type { TaskItem } from "@/components/dashboard/timeline";
import {
  GridProvider,
  SettingsPanel,
  GridSurface,
  GridSync,
  getPredefinedLayout,
  DEFAULT_LAYOUT_ID,
  type GridLayout,
  type WidgetData,
  type UpcomingTask,
} from "@/components/dashboard/grid";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

interface TasksResponse {
  tasks: TaskItem[];
  completedToday: number;
  totalToday: number;
  missedYesterday: TaskItem[];
}

function localParams() {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const localDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  return { localDate, localTime, query: `localDate=${localDate}&localTime=${localTime}&localDay=${localDay}` };
}

// Live clock (updates every second, includes seconds). Isolated in its own
// component so the 1s tick only re-renders the clock, not the whole page.
function HeaderClockDisplay() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <span
      className="font-mono text-base font-semibold tabular-nums text-foreground"
      aria-label="Current time"
    >
      {time}
    </span>
  );
}

// Hides the header clock when the user has placed a Clock widget on the grid.
// The pill wrapper is included here so it disappears entirely when hidden.
// Must be rendered inside <GridProvider> to access useGrid().
function HeaderClock() {
  const { widgets } = useGrid();
  const hasClockWidget = widgets.some((w) => w.type === "clock");
  if (hasClockWidget) return null;
  return (
    <motion.div layout transition={{ type: "spring", stiffness: 100, damping: 30 }} className="flex h-9 items-center rounded-full bg-card/80 px-4 shadow-sm backdrop-blur-sm">
      <HeaderClockDisplay />
    </motion.div>
  );
}

// ── Grid Ticker ──────────────────────────────────────────────────────────────
// A pill-shaped live ticker that sits at the bottom of the grid layout.
// When it has items it renders and pushes the grid up; when empty it unmounts
// so the grid reclaims the space. Uses the same socket events as LiveTicker.

interface TickerItem {
  id: string;
  text: string;
  icon: string;
  timestamp: number;
}

const MAX_TICKER_ITEMS = 20;
const TICKER_SPEED_PX = 65; // px/s

function GridTickerBar({ currentLocationId }: { currentLocationId?: string }) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const { socket } = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef<number | null>(null); // null = not yet initialised

  // Hydrate ARL-pushed messages on mount
  useEffect(() => {
    fetch("/api/ticker")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        const arlItems: TickerItem[] = (data.messages || []).map(
          (m: { id: string; icon: string; content: string; arlName: string; createdAt: string }) => ({
            id: `arl-${m.id}`,
            text: `${m.content} — ${m.arlName}`,
            icon: m.icon,
            timestamp: new Date(m.createdAt).getTime(),
          })
        );
        if (arlItems.length > 0) setItems(arlItems.slice(0, MAX_TICKER_ITEMS));
      })
      .catch(() => {});
  }, []);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const add = (item: TickerItem) =>
      setItems((prev) => [item, ...prev].slice(0, MAX_TICKER_ITEMS));

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
    const onTickerDelete = (d: { id: string }) => {
      setItems((prev) => prev.filter((i) => i.id !== `arl-${d.id}`));
    };

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

  // RAF scroll: single copy, starts at container right edge, exits left, loops
  useEffect(() => {
    if (items.length === 0) return;

    cancelAnimationFrame(animRef.current);
    posRef.current = null; // reset so we re-measure on next frame

    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const container = containerRef.current;
      const span = spanRef.current;
      if (container && span) {
        const cw = container.clientWidth;
        const sw = span.offsetWidth;

        // Initialise starting position to just off the right edge
        if (posRef.current === null) posRef.current = cw;

        posRef.current -= TICKER_SPEED_PX * dt;

        // When fully off left edge, jump back to just off right edge
        if (posRef.current < -sw) posRef.current = cw;

        span.style.transform = `translateX(${posRef.current}px)`;
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [items.length]);

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const hasItems = items.length > 0;
  const tickerText = hasItems
    ? items.map((i) => `${i.icon}  ${i.text}  ·  ${fmt(i.timestamp)}`).join("          ")
    : "";

  return (
    <AnimatePresence initial={false}>
      {hasItems && (
        <motion.div
          key="ticker"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="mx-3 mb-3 flex h-9 shrink-0 items-center overflow-hidden rounded-full bg-card/80 shadow-sm backdrop-blur-sm"
        >
          {/* LIVE badge — rounded left, flat right */}
          <div className="flex h-full shrink-0 items-center gap-1.5 rounded-l-full bg-primary px-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground">Live</span>
          </div>
          {/* Scrolling text — single copy, RAF, absolute position within relative container */}
          <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden" style={{ height: "100%" }}>
            <span
              ref={spanRef}
              className="absolute inset-y-0 flex items-center whitespace-nowrap text-xs font-medium text-foreground/80"
              style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
            >
              {tickerText}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function GridDashboardPage() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();

  const [data, setData] = useState<TasksResponse | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Record<string, UpcomingTask[]>>({});
  const [chatUnread, setChatUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);
  const [formsOpen, setFormsOpen] = useState(false);

  const [initialLayout, setInitialLayout] = useState<GridLayout | null>(null);

  // Stable per-device id so we can ignore the layout-update broadcast that
  // originated from this very device.
  const deviceIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`
  );

  // ---- Data fetching -------------------------------------------------------
  const fetchTasks = useCallback(async () => {
    try {
      const { query } = localParams();
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
  }, []);

  const fetchChatUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const json = await res.json();
        const total = (json.conversations || []).reduce(
          (sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount || 0),
          0
        );
        setChatUnread(total);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  // ---- Load persisted grid layout (once) -----------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let resolved: GridLayout | null = null;
      try {
        const res = await fetch("/api/preferences/grid-layout");
        if (res.ok) {
          const json = await res.json();
          if (json?.layout && Array.isArray(json.layout.widgets)) {
            resolved = json.layout as GridLayout;
          }
        }
      } catch {
        /* fall back to default */
      }
      if (!cancelled) {
        setInitialLayout(resolved ?? getPredefinedLayout(DEFAULT_LAYOUT_ID)!);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Initial + periodic data load
  useEffect(() => {
    if (!user) return;
    fetchTasks();
    fetchChatUnread();
  }, [user, fetchTasks, fetchChatUnread]);

  // Real-time refresh via socket (subscribed at top level — never inside an effect body as a hook)
  useEffect(() => {
    if (!socket) return;
    const onTask = () => fetchTasks();
    const onMsg = () => fetchChatUnread();
    socket.on("task:completed", onTask);
    socket.on("task:updated", onTask);
    socket.on("message:new", onMsg);
    socket.on("message:read", onMsg);
    return () => {
      socket.off("task:completed", onTask);
      socket.off("task:updated", onTask);
      socket.off("message:new", onMsg);
      socket.off("message:read", onMsg);
    };
  }, [socket, fetchTasks, fetchChatUnread]);

  // ---- Task handlers -------------------------------------------------------
  const handleComplete = useCallback(
    async (taskId: string) => {
      const { localDate } = localParams();
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === taskId ? { ...t, isCompleted: true, isOverdue: false, isDueSoon: false } : t
              ),
            }
          : prev
      );
      try {
        await fetch("/api/tasks/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, localDate }),
        });
        await fetchTasks();
      } catch (err) {
        console.error("Failed to complete task:", err);
      }
    },
    [fetchTasks]
  );

  const handleUncomplete = useCallback(
    async (taskId: string) => {
      const { localDate } = localParams();
      try {
        await fetch("/api/tasks/uncomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, localDate }),
        });
        await fetchTasks();
      } catch (err) {
        console.error("Failed to uncomplete task:", err);
      }
    },
    [fetchTasks]
  );

  const handleEarlyComplete = useCallback(
    async (taskId: string, dateStr: string) => {
      try {
        await fetch("/api/tasks/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, localDate: dateStr }),
        });
        await fetchTasks();
      } catch (err) {
        console.error("Failed to early-complete task:", err);
      }
    },
    [fetchTasks]
  );

  const handleEarlyUncomplete = useCallback(
    async (taskId: string, dateStr: string) => {
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
    },
    [fetchTasks]
  );

  // ---- Save layout (explicit, on demand) -----------------------------------
  // No auto-save: the user commits with the Save button. We tag the request
  // with this device's id so the server's broadcast back to the location's
  // other devices can be ignored here (we already have the layout).
  const saveLayout = useCallback(async (layout: GridLayout) => {
    const res = await fetch("/api/preferences/grid-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layout: layout.isCustom ? layout : null,
        deviceId: deviceIdRef.current,
      }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  }, []);

  // Stable launcher callbacks so they don't change widgetData identity.
  // Opening from a conversation row jumps straight into that thread (fullscreen).
  const openChat = useCallback((conversationId?: string) => {
    setChatThreadId(conversationId ?? null);
    setChatOpen(true);
  }, []);
  const openForms = useCallback(() => setFormsOpen(true), []);



  // ---- Build widget data bundle -------------------------------------------
  // Memoized so transient re-renders (e.g. socket connect/disconnect toggling
  // the provider's context value) DON'T change the object identity. Without
  // this, every reconnect rebuilt `widgetData`, defeated the memo() on the
  // widgets, and re-rendered every widget body — which looked like a refresh.
  const widgetData = useMemo<WidgetData>(() => {
    const tasks = data?.tasks ?? [];
    return {
      tasks,
      onComplete: handleComplete,
      onUncomplete: handleUncomplete,
      upcomingTasks,
      onEarlyComplete: handleEarlyComplete,
      onEarlyUncomplete: handleEarlyUncomplete,
      completedToday: tasks.filter((t) => t.isCompleted),
      missedYesterday: data?.missedYesterday ?? [],
      totalToday: data?.totalToday ?? 0,
      chatUnread,
      onOpenChat: openChat,
      onOpenForms: openForms,
    };
  }, [
    data,
    upcomingTasks,
    chatUnread,
    handleComplete,
    handleUncomplete,
    handleEarlyComplete,
    handleEarlyUncomplete,
    openChat,
    openForms,
  ]);

  const { theme, setTheme } = useTheme();
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

  const currentLocationId =
    user.userType === "location" ? (user.locationId || user.id) : undefined;

  return (
    <GridProvider initialLayout={initialLayout}>
      <GridSync socket={socket} deviceId={deviceIdRef.current} />
      <div className="flex h-screen flex-col bg-background">
        {/* Floating pill header — all layout elements share a LayoutGroup so
            Framer Motion coordinates repositioning across component boundaries */}
        <LayoutGroup id="grid-header">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-background px-4">
          {/* Logo + name pill — layout-animated so it smoothly shrinks when settings pills appear */}
          <motion.div layout transition={{ type: "spring", stiffness: 100, damping: 30 }} className="flex h-9 flex-1 items-center gap-2.5 rounded-full bg-card/80 px-4 shadow-sm backdrop-blur-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-black text-primary-foreground">H</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground leading-none">Dashboard</p>
              {user.name && (
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{user.name}</p>
              )}
            </div>
          </motion.div>

          {/* Right side: settings group (layout-animated, grows leftward) + fixed pills */}
          <div className="flex items-center gap-2">
            {/* Settings group — only these animate; connection+signout stay fixed */}
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 100, damping: 30 }}
              className="flex items-center gap-2"
            >
              {/* Clock pill — hidden when a Clock widget is on the grid */}
              <HeaderClock />
              {/* Settings panel: layout picker + customize + theme — animates out from cog */}
              <SettingsPanel
                onSave={saveLayout}
                theme={theme}
                themeMounted={themeMounted}
                onCycleTheme={cycleTheme}
              />
            </motion.div>
            {/* Connection status — not layout-animated, always pinned */}
            <ConnectionStatus />
            {/* Sign out pill — not layout-animated, always pinned */}
            <button
              type="button"
              onClick={() => logout()}
              className="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3 shadow-sm backdrop-blur-sm text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>
        </LayoutGroup>

        {/* Grid — layout-animated so it smoothly resizes when ticker mounts/unmounts */}
        <motion.div layout className="min-h-0 flex-1">
          <GridSurface data={widgetData} />
        </motion.div>

        {/* Live ticker pill — mounts/unmounts based on whether there are items,
            AnimatePresence drives the slide-up entrance and slide-down exit.
            GridTickerBar handles its own show/hide; we wrap it for animation. */}
        <GridTickerBar currentLocationId={currentLocationId} />

        {/* Overlays (existing components, unmodified) */}
        <RestaurantChat
          isOpen={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setChatThreadId(null);
          }}
          unreadCount={chatUnread}
          onUnreadChange={setChatUnread}
          currentUserId={user.id}
          chatThreadId={chatThreadId}
          startFullscreen
        />
        {formsOpen && <FormsViewer onClose={() => setFormsOpen(false)} />}

        <div className="fixed bottom-4 left-4 z-50">
          <OfflineIndicator />
        </div>
      </div>
    </GridProvider>
  );
}
