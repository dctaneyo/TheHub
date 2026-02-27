"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2, Bell, MessageCircle, ClipboardCheck, Radio, Trophy, Sparkles, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Notification {
  id: string;
  userId: string;
  userType: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  priority: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

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

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onCountsUpdate: (counts: { total: number; unread: number; urgent: number }) => void;
  taskNotifications?: TaskNotification[];
  onDismissTask?: (id: string) => void;
  onDismissAllTasks?: () => void;
}

const priorityColors = {
  urgent: "border-l-red-500 bg-red-500/5",
  high: "border-l-orange-500 bg-orange-500/5",
  normal: "border-l-blue-500 bg-blue-500/5",
  low: "border-l-gray-400 bg-muted/50",
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  task_due_soon: ClipboardCheck,
  task_overdue: AlertCircle,
  new_message: MessageCircle,
  emergency_broadcast: Radio,
  achievement_unlocked: Trophy,
  new_shoutout: Sparkles,
  default: Bell,
};

export function NotificationPanel({ open, onClose, onCountsUpdate, taskNotifications = [], onDismissTask, onDismissAllTasks }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const prevOpenRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const unreadParam = filter === "unread" ? "&unread_only=true" : "";
      const res = await fetch(`/api/notifications?limit=20${unreadParam}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        onCountsUpdate({
          total: data.total,
          unread: data.unread,
          urgent: data.urgent,
        });
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [filter, onCountsUpdate]);

  // Only fetch when panel opens or filter changes — not on every render
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      fetchNotifications();
    }
    prevOpenRef.current = open;
  }, [open, fetchNotifications]);

  // Re-fetch when filter changes while open
  useEffect(() => {
    if (open) fetchNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "POST" });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      fetchNotifications(); // Refresh to update counts
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifications(); // Refresh to update counts
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return format(new Date(timestamp), "MMM d");
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-2 top-16 z-50 w-[calc(100vw-16px)] md:w-[380px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Notifications</h3>
            <p className="text-[10px] text-muted-foreground">
              {filter === "all" ? "All notifications" : "Unread only"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMarkAllRead}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Mark all as read"
            >
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">All</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-medium transition-colors",
              filter === "all"
                ? "border-b-2 border-[var(--hub-red)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-medium transition-colors",
              filter === "unread"
                ? "border-b-2 border-[var(--hub-red)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Unread
          </button>
        </div>

        {/* Notifications list */}
        <div className="max-h-[500px] overflow-y-auto">
          {/* Task notifications section */}
          {taskNotifications.length > 0 && (
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Alerts</span>
                {onDismissAllTasks && (
                  <button onClick={onDismissAllTasks} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
                    Dismiss all
                  </button>
                )}
              </div>
              {taskNotifications.map((tn) => (
                <div key={tn.id} className={cn(
                  "group relative border-l-4 border-b border-border px-4 py-3",
                  tn.type === "overdue" ? "border-l-red-500 bg-red-500/5" : "border-l-amber-500 bg-amber-500/5"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      tn.type === "overdue" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {tn.type === "overdue" ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {tn.type === "overdue" ? "Overdue Task" : "Due Soon"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{tn.title}</p>
                      <p className="text-[10px] text-muted-foreground">Due at {formatTime12(tn.dueTime)}</p>
                    </div>
                    {onDismissTask && (
                      <button onClick={() => onDismissTask(tn.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground transition-opacity">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && notifications.length === 0 && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-[var(--hub-red)]" />
            </div>
          )}

          {!loading && notifications.length === 0 && taskNotifications.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || typeIcons.default;
              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    "group relative border-l-4 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
                    priorityColors[notification.priority as keyof typeof priorityColors] || priorityColors.normal,
                    !notification.isRead && "bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      notification.priority === "urgent" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                      notification.priority === "high" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm leading-tight",
                        notification.isRead ? "text-muted-foreground" : "font-semibold text-foreground"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-muted-foreground">
                          {getTimeAgo(notification.createdAt)}
                        </span>
                        {notification.actionUrl && (
                          <a
                            href={notification.actionUrl}
                            onClick={() => {
                              handleMarkAsRead(notification.id);
                              onClose();
                            }}
                            className="text-[10px] font-medium text-[var(--hub-red)] hover:underline"
                          >
                            {notification.actionLabel || "View"}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
