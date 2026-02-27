"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./notification-panel";
import { useSocket } from "@/lib/socket-context";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ total: 0, unread: 0, urgent: 0 });
  const { socket } = useSocket();

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (res.ok) {
        const data = await res.json();
        setCounts({
          total: data.total,
          unread: data.unread,
          urgent: data.urgent,
        });
      }
    } catch (error) {
      console.error("Failed to fetch notification counts:", error);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Listen for new notifications via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { count: { total: number; unread: number; urgent: number } }) => {
      setCounts(data.count);
      
      // Play sound for high/urgent priority notifications
      if (data.count.urgent > counts.urgent) {
        playNotificationSound();
      }
    };

    const handleNotificationRead = () => {
      fetchCounts();
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("notification:read", handleNotificationRead);
    socket.on("notification:deleted", handleNotificationRead);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:read", handleNotificationRead);
      socket.off("notification:deleted", handleNotificationRead);
    };
  }, [socket, fetchCounts, counts.urgent]);

  const playNotificationSound = () => {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error("Failed to play notification sound:", error);
    }
  };

  const handleCountsUpdate = (newCounts: { total: number; unread: number; urgent: number }) => {
    setCounts(newCounts);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
          className
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        
        {/* Unread badge */}
        <AnimatePresence>
          {counts.unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={cn(
                "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                counts.urgent > 0 ? "bg-red-600 animate-pulse" : "bg-[var(--hub-red)]"
              )}
            >
              {counts.unread > 99 ? "99+" : counts.unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        onCountsUpdate={handleCountsUpdate}
      />
    </div>
  );
}
