"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TaskItem } from "./timeline";
import { useSocket } from "@/lib/socket-context";

interface NotificationSystemProps {
  tasks: TaskItem[];
  currentTime: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

interface Notification {
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

export function NotificationSystem({ tasks, currentTime, soundEnabled, onToggleSound }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { socket } = useSocket();

  // Load dismissed notifications from DB on mount
  useEffect(() => {
    fetch('/api/notifications/dismiss')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) notifiedRef.current = new Set(d.dismissedIds); })
      .catch(() => {});
  }, []);

  // Cross-kiosk dismiss sync — when another kiosk at this location dismisses, mirror it here
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { notificationIds: string[] }) => {
      data.notificationIds.forEach((id) => notifiedRef.current.add(id));
      setNotifications((prev) =>
        prev.map((n) => data.notificationIds.includes(n.id) ? { ...n, dismissed: true } : n)
      );
    };
    socket.on('notification:dismissed', handler);
    return () => { socket.off('notification:dismissed', handler); };
  }, [socket]);

  // Save dismissed notifications to database
  const saveDismissedNotifications = useCallback(async (notificationIds: string[]) => {
    try {
      const response = await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      
      if (!response.ok) {
        console.error('Failed to save dismissed notifications');
      }
    } catch (error) {
      console.error('Failed to save dismissed notifications:', error);
    }
  }, []);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczIj2markup");
    // Use Web Audio API for a simple notification beep
    return () => {
      audioRef.current = null;
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gainNode.gain.value = 0.15;

      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.stop(ctx.currentTime + 0.5);

      // Second beep
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 1100;
          osc2.type = "sine";
          gain2.gain.value = 0.15;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc2.stop(ctx.currentTime + 0.5);
        } catch {}
      }, 200);
    } catch {}
  }, [soundEnabled]);

  // Auto-dismiss notifications for tasks that are now completed
  useEffect(() => {
    const completedIds = new Set(tasks.filter((t) => t.isCompleted).map((t) => t.id));
    if (completedIds.size === 0) return;
    setNotifications((prev) =>
      prev.map((n) => (completedIds.has(n.taskId) ? { ...n, dismissed: true } : n))
    );
  }, [tasks]);

  // ── Server-pushed exact-time notifications ──
  // Dedup is purely client-side via notifiedRef — no DB write needed on receive.
  const fireNotification = useCallback((
    type: "due_soon" | "overdue",
    data: { taskId: string; title: string; dueTime: string }
  ) => {
    const id = `${type === "due_soon" ? "due" : "overdue"}-${data.taskId}`;
    if (notifiedRef.current.has(id)) return;
    notifiedRef.current.add(id);
    setNotifications((prev) => [{
      id, taskId: data.taskId, title: data.title,
      type, dueTime: data.dueTime, dismissed: false,
    }, ...prev]);
    playNotificationSound();
    setShowPanel(true);
  }, [playNotificationSound]);

  useEffect(() => {
    if (!socket) return;
    const handleDueSoon = (data: { taskId: string; title: string; dueTime: string }) =>
      fireNotification("due_soon", data);
    const handleOverdue = (data: { taskId: string; title: string; dueTime: string }) =>
      fireNotification("overdue", data);
    socket.on('task:due-soon', handleDueSoon);
    socket.on('task:overdue', handleOverdue);
    return () => {
      socket.off('task:due-soon', handleDueSoon);
      socket.off('task:overdue', handleOverdue);
    };
  }, [socket, fireNotification]);

  // Fallback: catch any due-soon/overdue tasks that the server push may have missed
  // (e.g. reconnect after a brief disconnect). Purely client-side dedup via notifiedRef.
  useEffect(() => {
    if (!currentTime || tasks.length === 0) return;
    const nowMinutes = timeToMinutes(currentTime);
    const newNotifications: Notification[] = [];

    for (const task of tasks) {
      if (task.isCompleted) continue;
      const taskMinutes = timeToMinutes(task.dueTime);
      const isOverdue = taskMinutes < nowMinutes;
      const isDueSoon = !isOverdue && taskMinutes <= nowMinutes + DUE_SOON_MINUTES;
      const overdueId = `overdue-${task.id}`;
      const dueId = `due-${task.id}`;

      if (isOverdue && !notifiedRef.current.has(overdueId)) {
        notifiedRef.current.add(overdueId);
        newNotifications.push({ id: overdueId, taskId: task.id, title: task.title, type: "overdue", dueTime: task.dueTime, dismissed: false });
      }
      if (isDueSoon && !notifiedRef.current.has(dueId)) {
        notifiedRef.current.add(dueId);
        newNotifications.push({ id: dueId, taskId: task.id, title: task.title, type: "due_soon", dueTime: task.dueTime, dismissed: false });
      }
    }

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
      playNotificationSound();
      setShowPanel(true);
    }
  }, [tasks, currentTime, playNotificationSound]);
  // NOTE: currentTime is HH:mm — changes once per minute, so this fires at most once per minute.

  const dismissNotification = async (id: string) => {
    // Add to dismissed set and save to database
    notifiedRef.current.add(id);
    await saveDismissedNotifications([id]);
    
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    );
  };

  const dismissAll = async () => {
    // Add all current notifications to dismissed set and save to database
    const notificationIds = notifications.map((n) => n.id);
    notifications.forEach((n) => notifiedRef.current.add(n.id));
    await saveDismissedNotifications(notificationIds);
    
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })));
    setShowPanel(false);
  };

  // Wrapper functions for button handlers
  const handleDismissNotification = (id: string) => {
    dismissNotification(id);
  };

  const handleDismissAll = () => {
    dismissAll();
  };

  const activeNotifications = notifications.filter((n) => !n.dismissed);
  const overdueNotifications = activeNotifications.filter((n) => n.type === "overdue");
  const hasActive = activeNotifications.length > 0;

  // ── Fullscreen overdue alarm ──
  const overdueAlarmRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playOverdueAlarm = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      // Loud, attention-grabbing 3-tone alarm
      [[880, 0, 0.2, 0.4], [660, 0.25, 0.2, 0.4], [880, 0.5, 0.2, 0.4],
       [660, 0.75, 0.2, 0.4], [1100, 1.0, 0.35, 0.5]].forEach(([freq, delay, dur, vol]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur);
      });
    } catch {}
  }, [soundEnabled]);

  // Start/stop repeating alarm when overdue notifications appear/disappear
  useEffect(() => {
    if (overdueNotifications.length > 0) {
      playOverdueAlarm();
      overdueAlarmRef.current = setInterval(playOverdueAlarm, 5000);
    } else {
      if (overdueAlarmRef.current) {
        clearInterval(overdueAlarmRef.current);
        overdueAlarmRef.current = null;
      }
    }
    return () => {
      if (overdueAlarmRef.current) {
        clearInterval(overdueAlarmRef.current);
        overdueAlarmRef.current = null;
      }
    };
  }, [overdueNotifications.length, playOverdueAlarm]);

  const handleDismissOverdue = () => {
    const ids = overdueNotifications.map((n) => n.id);
    ids.forEach((id) => notifiedRef.current.add(id));
    saveDismissedNotifications(ids);
    setNotifications((prev) => prev.map((n) => n.type === "overdue" ? { ...n, dismissed: true } : n));
  };

  return (
    <>
      {/* ── FULLSCREEN OVERDUE OVERLAY ── */}
      <AnimatePresence>
        {overdueNotifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          >
            <motion.div
              animate={{ boxShadow: ["0 0 0 0 rgba(220,38,38,0.7)", "0 0 0 20px rgba(220,38,38,0)", "0 0 0 0 rgba(220,38,38,0)"] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-full max-w-lg mx-4 rounded-3xl bg-white overflow-hidden"
            >
              {/* Red header */}
              <div className="bg-[var(--hub-red)] px-6 py-5 flex items-center gap-3">
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <AlertTriangle className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-wide">OVERDUE TASKS</h2>
                  <p className="text-[11px] text-red-100 mt-0.5">{overdueNotifications.length} task{overdueNotifications.length > 1 ? "s" : ""} past due</p>
                </div>
              </div>

              {/* Task list */}
              <div className="px-6 py-5 space-y-3 max-h-64 overflow-y-auto">
                {overdueNotifications.map((notif) => (
                  <div key={notif.id} className="flex items-center gap-3 rounded-xl bg-red-50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100">
                      <Clock className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{notif.title}</p>
                      <p className="text-xs text-red-500">Due at {formatTime12(notif.dueTime)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dismiss button */}
              <div className="px-6 pb-6">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDismissOverdue}
                  className="w-full rounded-2xl border-2 border-slate-200 py-4 text-base font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Acknowledge &amp; Dismiss
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification bell with count */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
          hasActive
            ? "bg-red-50 text-[var(--hub-red)] animate-pulse"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        )}
      >
        <Bell className="h-4 w-4" />
        {hasActive && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hub-red)] text-[9px] font-bold text-white">
            {activeNotifications.length}
          </span>
        )}
      </button>

      {/* Notification panel (due-soon only when overdue overlay is not showing) */}
      <AnimatePresence>
        {showPanel && overdueNotifications.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-4 top-14 z-50 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              <div className="flex items-center gap-2">
                {hasActive && (
                  <button
                    onClick={handleDismissAll}
                    className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
                  >
                    Dismiss all
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {activeNotifications.length === 0 ? (
                <div className="flex h-20 items-center justify-center">
                  <p className="text-xs text-slate-400">No active notifications</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activeNotifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl p-3",
                        notif.type === "overdue" ? "bg-red-50" : "bg-amber-50"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          notif.type === "overdue"
                            ? "bg-red-100 text-red-600"
                            : "bg-amber-100 text-amber-600"
                        )}
                      >
                        {notif.type === "overdue" ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800">
                          {notif.type === "overdue" ? "Overdue Task" : "Due Soon"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">
                          {notif.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Due at {formatTime12(notif.dueTime)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDismissNotification(notif.id)}
                        className="shrink-0 text-slate-300 hover:text-slate-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
