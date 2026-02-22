"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { Activity, CheckCircle, MessageCircle, Trophy, Zap, Trash2 } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "task_completed" | "message_sent" | "high_five" | "shoutout" | "achievement";
  userName: string;
  userType: string;
  description: string;
  timestamp: string;
  icon?: string;
}

export function LiveActivityFeed({ maxItems = 10 }: { maxItems?: number }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { socket } = useSocket();

  // Load activities from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('live-activity-feed');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActivities(parsed.slice(0, maxItems));
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

    const handleHighFive = (data: any) => {
      const activity: ActivityItem = {
        id: `hf-${data.id}-${Date.now()}`,
        type: "high_five",
        userName: data.from_user_name,
        userType: data.from_user_type,
        description: `sent a high-five to ${data.to_user_name}`,
        timestamp: data.created_at,
        icon: "🙌",
      };
      addActivity(activity);
    };

    const handleShoutout = (data: any) => {
      const activity: ActivityItem = {
        id: `shout-${data.id}-${Date.now()}`,
        type: "shoutout",
        userName: data.from_user_name,
        userType: data.from_user_type,
        description: `gave a shoutout to ${data.to_location_name}`,
        timestamp: data.created_at,
        icon: "📣",
      };
      addActivity(activity);
    };

    socket.on("task:completed", handleTaskCompleted);
    socket.on("message:new", handleMessageNew);
    socket.on("high-five:received", handleHighFive);
    socket.on("shoutout:new", handleShoutout);

    return () => {
      socket.off("task:completed", handleTaskCompleted);
      socket.off("message:new", handleMessageNew);
      socket.off("high-five:received", handleHighFive);
      socket.off("shoutout:new", handleShoutout);
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
      case "high_five":
        return <span className="text-base">🙌</span>;
      case "shoutout":
        return <span className="text-base">📣</span>;
      case "achievement":
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-slate-400" />;
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
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <Activity className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-xs font-semibold text-slate-400">No recent activity</p>
        <p className="text-[10px] text-slate-300 mt-1">Activity will appear here in real-time</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-yellow-500" />
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Live Activity</h3>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => { setActivities([]); localStorage.removeItem('live-activity-feed'); }}
            className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Clear all activity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-slate-400">Live</span>
        </div>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-start gap-2 rounded-lg bg-white border border-slate-100 p-2 hover:bg-slate-50 transition-colors"
            >
              <div className="shrink-0 mt-0.5">
                {getIcon(activity)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700">
                  <span className="font-semibold">{activity.userName}</span>
                  {" "}
                  <span className="text-slate-500">{activity.description}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
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
