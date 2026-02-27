"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, AlertTriangle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./notification-panel";
import { useSocket } from "@/lib/socket-context";
import { type TaskItem } from "@/components/dashboard/timeline";

interface TaskNotification {
  id: string;
  taskId: string;
  title: string;
  type: "due_soon" | "overdue";
  dueTime: string;
  dismissed: boolean;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const DUE_SOON_MINUTES = 30;
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface NotificationBellProps {
  className?: string;
  tasks?: TaskItem[];
  currentTime?: string;
  soundEnabled?: boolean;
}

export function NotificationBell({ className, tasks = [], currentTime = "", soundEnabled = true }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [dbCounts, setDbCounts] = useState({ total: 0, unread: 0, urgent: 0 });
  const { socket } = useSocket();

  // ── DB notification counts ──
  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (res.ok) {
        const data = await res.json();
        setDbCounts({ total: data.total, unread: data.unread, urgent: data.urgent });
      }
    } catch {}
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = (data: { count: { total: number; unread: number; urgent: number } }) => {
      setDbCounts(data.count);
    };
    const handleRead = () => fetchCounts();
    socket.on("notification:new", handleNew);
    socket.on("notification:read", handleRead);
    socket.on("notification:deleted", handleRead);
    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:read", handleRead);
      socket.off("notification:deleted", handleRead);
    };
  }, [socket, fetchCounts]);

  const handleCountsUpdate = useCallback((c: { total: number; unread: number; urgent: number }) => {
    setDbCounts(c);
  }, []);

  // ── Task notifications (due-soon / overdue) ──
  const [taskNotifs, setTaskNotifs] = useState<TaskNotification[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load dismissed from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("dismissed-notifications");
      if (stored) notifiedRef.current = new Set(JSON.parse(stored));
    } catch {}
  }, []);

  // Clean up dismissed for completed/removed tasks
  useEffect(() => {
    if (tasks.length === 0) return;
    const currentTaskIds = new Set(tasks.map((t) => t.id));
    const arr = Array.from(notifiedRef.current);
    let changed = false;
    const filtered = arr.filter((id) => {
      const taskId = id.replace(/^(due|overdue)-/, "");
      const task = tasks.find((t) => t.id === taskId);
      if (task && !task.isCompleted && currentTaskIds.has(taskId)) return true;
      changed = true;
      return false;
    });
    if (changed) {
      notifiedRef.current = new Set(filtered);
      localStorage.setItem("dismissed-notifications", JSON.stringify(filtered));
    }
  }, [tasks]);

  // Auto-dismiss for completed tasks
  useEffect(() => {
    const completedIds = new Set(tasks.filter((t) => t.isCompleted).map((t) => t.id));
    if (completedIds.size === 0) return;
    setTaskNotifs((prev) => prev.map((n) => (completedIds.has(n.taskId) ? { ...n, dismissed: true } : n)));
  }, [tasks]);

  // Cross-kiosk dismiss sync
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { notificationIds: string[] }) => {
      data.notificationIds.forEach((id) => notifiedRef.current.add(id));
      setTaskNotifs((prev) => prev.map((n) => (data.notificationIds.includes(n.id) ? { ...n, dismissed: true } : n)));
    };
    socket.on("notification:dismissed", handler);
    return () => { socket.off("notification:dismissed", handler); };
  }, [socket]);

  const saveDismissed = useCallback((ids: string[]) => {
    try {
      localStorage.setItem("dismissed-notifications", JSON.stringify(Array.from(notifiedRef.current)));
      if (socket) socket.emit("notification:dismiss", { notificationIds: ids });
    } catch {}
  }, [socket]);

  const playTaskSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine"; gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => {
        try {
          const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 1100; o2.type = "sine"; g2.gain.value = 0.15;
          o2.start();
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          o2.stop(ctx.currentTime + 0.5);
        } catch {}
      }, 200);
    } catch {}
  }, [soundEnabled]);

  // Server-pushed task notifications
  const fireTaskNotif = useCallback((type: "due_soon" | "overdue", data: { taskId: string; title: string; dueTime: string }) => {
    const id = `${type === "due_soon" ? "due" : "overdue"}-${data.taskId}`;
    if (notifiedRef.current.has(id)) return;
    notifiedRef.current.add(id);
    setTaskNotifs((prev) => [{ id, taskId: data.taskId, title: data.title, type, dueTime: data.dueTime, dismissed: false }, ...prev]);
    playTaskSound();
  }, [playTaskSound]);

  useEffect(() => {
    if (!socket) return;
    const onDueSoon = (d: { taskId: string; title: string; dueTime: string }) => fireTaskNotif("due_soon", d);
    const onOverdue = (d: { taskId: string; title: string; dueTime: string }) => fireTaskNotif("overdue", d);
    socket.on("task:due-soon", onDueSoon);
    socket.on("task:overdue", onOverdue);
    return () => { socket.off("task:due-soon", onDueSoon); socket.off("task:overdue", onOverdue); };
  }, [socket, fireTaskNotif]);

  // Client-side fallback time check
  useEffect(() => {
    if (!currentTime || tasks.length === 0) return;
    const nowMin = timeToMinutes(currentTime);
    const newNotifs: TaskNotification[] = [];
    for (const task of tasks) {
      if (task.isCompleted) continue;
      const taskMin = timeToMinutes(task.dueTime);
      const overdueId = `overdue-${task.id}`;
      const dueId = `due-${task.id}`;
      if (taskMin < nowMin && !notifiedRef.current.has(overdueId)) {
        notifiedRef.current.add(overdueId);
        newNotifs.push({ id: overdueId, taskId: task.id, title: task.title, type: "overdue", dueTime: task.dueTime, dismissed: false });
      }
      if (!task.isCompleted && taskMin >= nowMin && taskMin <= nowMin + DUE_SOON_MINUTES && !notifiedRef.current.has(dueId)) {
        notifiedRef.current.add(dueId);
        newNotifs.push({ id: dueId, taskId: task.id, title: task.title, type: "due_soon", dueTime: task.dueTime, dismissed: false });
      }
    }
    if (newNotifs.length > 0) {
      setTaskNotifs((prev) => [...newNotifs, ...prev]);
      playTaskSound();
    }
  }, [tasks, currentTime, playTaskSound]);

  // ── Overdue alarm ──
  const activeTaskNotifs = taskNotifs.filter((n) => !n.dismissed);
  const overdueNotifs = activeTaskNotifs.filter((n) => n.type === "overdue");
  const overdueAlarmRef = useRef<NodeJS.Timeout | null>(null);

  const playOverdueAlarm = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      [[880, 0, 0.2, 0.4], [660, 0.25, 0.2, 0.4], [880, 0.5, 0.2, 0.4],
       [660, 0.75, 0.2, 0.4], [1100, 1.0, 0.35, 0.5]].forEach(([freq, delay, dur, vol]) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay); osc.stop(t + delay + dur);
      });
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    if (overdueNotifs.length > 0) {
      playOverdueAlarm();
      overdueAlarmRef.current = setInterval(playOverdueAlarm, 5000);
    } else if (overdueAlarmRef.current) {
      clearInterval(overdueAlarmRef.current);
      overdueAlarmRef.current = null;
    }
    return () => { if (overdueAlarmRef.current) { clearInterval(overdueAlarmRef.current); overdueAlarmRef.current = null; } };
  }, [overdueNotifs.length, playOverdueAlarm]);

  const handleDismissOverdue = () => {
    const ids = overdueNotifs.map((n) => n.id);
    ids.forEach((id) => notifiedRef.current.add(id));
    saveDismissed(ids);
    setTaskNotifs((prev) => prev.map((n) => (n.type === "overdue" ? { ...n, dismissed: true } : n)));
  };

  const handleDismissTaskNotif = (id: string) => {
    notifiedRef.current.add(id);
    saveDismissed([id]);
    setTaskNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)));
  };

  const handleDismissAllTasks = () => {
    const ids = activeTaskNotifs.map((n) => n.id);
    ids.forEach((id) => notifiedRef.current.add(id));
    saveDismissed(ids);
    setTaskNotifs((prev) => prev.map((n) => ({ ...n, dismissed: true })));
  };

  // ── Combined count ──
  const totalActive = activeTaskNotifs.length + dbCounts.unread;
  const hasUrgent = overdueNotifs.length > 0 || dbCounts.urgent > 0;

  return (
    <>
      {/* ── FULLSCREEN OVERDUE OVERLAY ── */}
      <AnimatePresence>
        {overdueNotifs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          >
            <motion.div
              animate={{ boxShadow: ["0 0 0 0 rgba(220,38,38,0.7)", "0 0 0 20px rgba(220,38,38,0)", "0 0 0 0 rgba(220,38,38,0)"] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-full max-w-lg mx-4 rounded-3xl bg-card overflow-hidden"
            >
              <div className="bg-[var(--hub-red)] px-6 py-5 flex items-center gap-3">
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <AlertTriangle className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-wide">OVERDUE TASKS</h2>
                  <p className="text-[11px] text-red-100 mt-0.5">{overdueNotifs.length} task{overdueNotifs.length > 1 ? "s" : ""} past due</p>
                </div>
              </div>
              <div className="px-6 py-5 space-y-3 max-h-64 overflow-y-auto">
                {overdueNotifs.map((notif) => (
                  <div key={notif.id} className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-950/50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                      <Clock className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{notif.title}</p>
                      <p className="text-xs text-red-500">Due at {formatTime12(notif.dueTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6">
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleDismissOverdue}
                  className="w-full rounded-2xl border-2 border-border py-4 text-base font-bold text-muted-foreground hover:bg-muted transition-colors">
                  Acknowledge &amp; Dismiss
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bell icon ── */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
            totalActive > 0
              ? "bg-red-50 dark:bg-red-950/50 text-[var(--hub-red)]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            open && "bg-muted text-foreground",
            hasUrgent && "animate-pulse",
            className
          )}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {totalActive > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className={cn(
                  "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                  hasUrgent ? "bg-red-600 animate-pulse" : "bg-[var(--hub-red)]"
                )}>
                {totalActive > 99 ? "99+" : totalActive}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <NotificationPanel
          open={open && overdueNotifs.length === 0}
          onClose={() => setOpen(false)}
          onCountsUpdate={handleCountsUpdate}
          taskNotifications={activeTaskNotifs}
          onDismissTask={handleDismissTaskNotif}
          onDismissAllTasks={handleDismissAllTasks}
        />
      </div>
    </>
  );
}
