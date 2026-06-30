"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { Activity, CheckCircle, MessageCircle, Trash2 } from "@/lib/icons";

interface ActivityItem {
  id: string;
  type: "task_completed" | "message_sent";
  userName: string;
  userType: string;
  description: string;
  timestamp: string;
  icon?: string;
}

export function LiveActivityFeed({ maxItems = 10, showHeader = true }: { maxItems?: number; showHeader?: boolean }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { socket } = useSocket();

  // Load activities from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('live-activity-feed');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter((a: ActivityItem) =>
          a.type === "task_completed" || a.type === "message_sent"
        );
        setActivities(filtered.slice(0, maxItems));
      } catch (err) {
        console.error('Failed to parse stored activities:', err);
      }
    }
  }, [maxItems]);

  // Save activities to localStorage whenever they change
  useEffect(() => {
    if (activities.length > 0) {
      localStorage.setItem('live-activity-feed', JSON.stringify(activities));
    }
  }, [activities]);

  useEffect(() => {
    if (!socket) return;

    const handleTaskCompleted = (data: any) => {
      const activity: ActivityItem = {
        id: `task-${data.taskId}-${Date.now()}`,
        type: "task_completed",
        userName: data.locationName || "Someone",
        userType: "location",
        description: `completed "${data.taskTitle}"`,
        timestamp: new Date().toISOString(),
        icon: "✅",
      };
      addActivity(activity);
    };

    const handleMessageNew = (data: any) => {
      const activity: ActivityItem = {
        id: `msg-${data.id}-${Date.now()}`,
        type: "message_sent",
        userName: data.senderName,
        userType: data.senderType,
        description: "sent a message",
        timestamp: data.createdAt,
        icon: "💬",
      };
      addActivity(activity);
    };

    socket.on("task:completed", handleTaskCompleted);
    socket.on("message:new", handleMessageNew);

    return () => {
      socket.off("task:completed", handleTaskCompleted);
      socket.off("message:new", handleMessageNew);
    };
  }, [socket]);

  const addActivity = (activity: ActivityItem) => {
    setActivities(prev => [activity, ...prev].slice(0, maxItems));
  };

  const getIcon = (activity: ActivityItem) => {
    switch (activity.type) {
      case "task_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "message_sent":
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted p-6 text-center">
        <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-xs font-semibold text-muted-foreground">No recent activity</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Activity will appear here in real-time</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header — suppressed when embedded under a panel that already
          provides one (see overview-dashboard.tsx's merged Live Feed) */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {showHeader ? (
          <>
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent Activity</h3>
          </>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</p>
        )}
        <button
          onClick={() => { setActivities([]); localStorage.removeItem('live-activity-feed'); }}
          className="ml-auto p-1 rounded-md text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 active:text-red-500 dark:active:text-red-400 active:bg-red-500/10 transition-colors"
          title="Clear all activity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1 flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-start gap-2 rounded-lg bg-card border border-border p-2"
            >
              <div className="shrink-0 mt-1">
                {getIcon(activity)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground">
                  <span className="font-semibold">{activity.userName}</span>
                  {" "}
                  <span className="text-muted-foreground">{activity.description}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getTimeAgo(activity.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
