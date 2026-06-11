"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { Loader2, LogOut } from "@/lib/icons";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { ConnectionStatus } from "@/components/connection-status";
import { OfflineIndicator } from "@/components/offline-indicator";
import type { TaskItem } from "@/components/dashboard/timeline";
import {
  GridDashboard,
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
  pointsToday: number;
}

function localParams() {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const localDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  return { localDate, localTime, query: `localDate=${localDate}&localTime=${localTime}&localDay=${localDay}` };
}

export default function GridDashboardPage() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();

  const [data, setData] = useState<TasksResponse | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Record<string, UpcomingTask[]>>({});
  const [chatUnread, setChatUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);

  const [initialLayout, setInitialLayout] = useState<GridLayout | null>(null);

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

  // ---- Persist layout ------------------------------------------------------
  // Save custom layouts; clear the saved layout when a predefined one is chosen.
  const persistLayout = useCallback((layout: GridLayout) => {
    fetch("/api/preferences/grid-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: layout.isCustom ? layout : null }),
    }).catch(() => {});
  }, []);

  // Stable launcher callbacks so they don't change widgetData identity.
  const openChat = useCallback(() => setChatOpen(true), []);
  const openForms = useCallback(() => setFormsOpen(true), []);

  const currentLocationId =
    user?.userType === "location" ? user.locationId || user.id : undefined;

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
      completedToday: tasks.filter((t) => t.isCompleted),
      missedYesterday: data?.missedYesterday ?? [],
      pointsToday: data?.pointsToday ?? 0,
      totalToday: data?.totalToday ?? 0,
      currentLocationId,
      chatUnread,
      onOpenChat: openChat,
      onOpenForms: openForms,
    };
  }, [
    data,
    upcomingTasks,
    chatUnread,
    currentLocationId,
    handleComplete,
    handleUncomplete,
    handleEarlyComplete,
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
    <div className="flex h-screen flex-col bg-background">
      {/* Lightweight header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-black text-primary-foreground">H</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">Dashboard</p>
            {user.name && (
              <p className="text-[10px] text-muted-foreground">{user.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Connection status + session ID (kiosk-critical) */}
          <ConnectionStatus />
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="min-h-0 flex-1">
        <GridDashboard
          data={widgetData}
          initialLayout={initialLayout}
          onPersist={persistLayout}
        />
      </div>

      {/* Overlays (existing components, unmodified) */}
      <RestaurantChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        unreadCount={chatUnread}
        onUnreadChange={setChatUnread}
        currentUserId={user.id}
      />
      {formsOpen && <FormsViewer onClose={() => setFormsOpen(false)} />}

      <div className="fixed bottom-4 left-4 z-50">
        <OfflineIndicator />
      </div>
    </div>
  );
}
