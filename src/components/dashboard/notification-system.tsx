"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, AlertTriangle, Clock, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TaskItem } from "./timeline";

interface NotificationSystemProps {
  tasks: TaskItem[];
  currentTime: string;
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

export function NotificationSystem({ tasks, currentTime }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load dismissed notifications from database on mount
  useEffect(() => {
    const loadDismissedNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/dismiss');
        if (response.ok) {
          const data = await response.json();
          notifiedRef.current = new Set(data.dismissedIds);
        }
      } catch (error) {
        console.error('Failed to load dismissed notifications:', error);
      }
    };

    loadDismissedNotifications();
  }, []);

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

  // Check for due-soon and overdue tasks
  useEffect(() => {
    if (!currentTime || tasks.length === 0) return;

    const checkAndCreateNotifications = async () => {
      const newNotifications: Notification[] = [];

      for (const task of tasks) {
        if (task.isCompleted) continue;

        const overdueId = `overdue-${task.id}`;
        const dueId = `due-${task.id}`;

        // Check if notification is already dismissed
        if (notifiedRef.current.has(overdueId) || notifiedRef.current.has(dueId)) {
          continue;
        }

        // Create notifications in database
        if (task.isOverdue) {
          try {
            const response = await fetch('/api/notifications/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'task_overdue',
                title: 'Overdue Task',
                body: task.title,
                referenceId: overdueId
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (!data.existing) {
                newNotifications.push({
                  id: overdueId,
                  taskId: task.id,
                  title: task.title,
                  type: "overdue",
                  dueTime: task.dueTime,
                  dismissed: false,
                });
              }
            }
          } catch (error) {
            console.error('Failed to create overdue notification:', error);
          }
        }

        if (task.isDueSoon) {
          try {
            const response = await fetch('/api/notifications/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'task_due_soon',
                title: 'Task Due Soon',
                body: task.title,
                referenceId: dueId
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (!data.existing) {
                newNotifications.push({
                  id: dueId,
                  taskId: task.id,
                  title: task.title,
                  type: "due_soon",
                  dueTime: task.dueTime,
                  dismissed: false,
                });
              }
            }
          } catch (error) {
            console.error('Failed to create due soon notification:', error);
          }
        }
      }

      if (newNotifications.length > 0) {
        setNotifications((prev) => [...newNotifications, ...prev]);
        playNotificationSound();
        setShowPanel(true);
      }
    };

    checkAndCreateNotifications();
  }, [tasks, currentTime, playNotificationSound]);

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
  const hasActive = activeNotifications.length > 0;

  return (
    <>
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

      {/* Sound toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
          soundEnabled
            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
            : "bg-red-50 text-red-400"
        )}
      >
        {soundEnabled ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
      </button>

      {/* Notification panel */}
      <AnimatePresence>
        {showPanel && (
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
