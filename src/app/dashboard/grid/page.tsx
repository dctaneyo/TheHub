"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { Loader2, LogOut } from "@/lib/icons";
import { useGrid } from "@/components/dashboard/grid";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { ConnectionStatus } from "@/components/connection-status";
import { OfflineIndicator } from "@/components/offline-indicator";
import type { TaskItem } from "@/components/dashboard/timeline";
import {
  GridProvider,
  GridControls,
  GridSurface,
  GridSync,
  getPredefinedLayout,
  DEFAULT_LAYOUT_ID,
  type GridLayout,
  type WidgetData,
  type UpcomingTask,
} from "@/components/dashboard/grid";

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
    <div className="flex h-9 items-center rounded-full bg-card/80 px-4 shadow-sm backdrop-blur-sm">
      <HeaderClockDisplay />
    </div>
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

  if (!user || !initialLayout) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GridProvider initialLayout={initialLayout}>
      <GridSync socket={socket} deviceId={deviceIdRef.current} />
      <div className="flex h-screen flex-col bg-background">
        {/* Floating pill header — no background, no border, elements float as pills */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-background px-4">
          {/* Logo + name pill — flex-1 so it fills the remaining header space */}
          <div className="flex h-9 flex-1 items-center gap-2.5 rounded-full bg-card/80 px-4 shadow-sm backdrop-blur-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-black text-primary-foreground">H</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground leading-none">Dashboard</p>
              {user.name && (
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{user.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clock pill — hidden when a Clock widget is on the grid */}
            <HeaderClock />
            {/* Layout / edit controls — each button already styled as pills inside GridControls */}
            <GridControls onSave={saveLayout} />
            {/* Connection status */}
            <ConnectionStatus />
            {/* Sign out pill */}
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

        {/* Grid */}
        <div className="min-h-0 flex-1">
          <GridSurface data={widgetData} />
        </div>

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
