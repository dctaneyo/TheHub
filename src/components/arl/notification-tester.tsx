"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TestTube, Bell, Send, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";

interface NotificationTesterProps {
  className?: string;
}

export function NotificationTester({ className }: NotificationTesterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { socket } = useSocket();

  // Mock location list - in real app this would come from API
  const locations = [
    { id: "loc-1", name: "Store #001 - Downtown" },
    { id: "loc-2", name: "Store #002 - Uptown" },
    { id: "loc-3", name: "Store #003 - Mall" },
    { id: "loc-4", name: "Store #004 - Airport" },
  ];

  const notificationTypes = [
    {
      id: "task_due_soon",
      label: "Task Due Soon",
      icon: "⏰",
      description: "Task is approaching due time",
      payload: {
        taskId: "test-task-123",
        title: "Test Task",
        dueTime: "14:00",
        points: 10,
      },
    },
    {
      id: "task_overdue",
      label: "Task Overdue",
      icon: "⚠️",
      description: "Task is past due time",
      payload: {
        taskId: "test-task-456",
        title: "Overdue Task",
        dueTime: "13:00",
        points: 5,
      },
    },
    {
      id: "meeting_started",
      label: "Meeting Started",
      icon: "📹",
      description: "New meeting has started",
      payload: {
        meetingId: "test-meeting-789",
        title: "Test Meeting",
        hostName: "Test Host",
        hostId: "test-host",
      },
    },
    {
      id: "meeting_ended",
      label: "Meeting Ended",
      icon: "🔚",
      description: "Meeting has ended",
      payload: {
        meetingId: "test-meeting-789",
        reason: "completed",
      },
    },
    {
      id: "broadcast_started",
      label: "Broadcast Started",
      icon: "📢",
      description: "Emergency broadcast active",
      payload: {
        broadcastId: "test-broadcast-012",
        arlName: "Test ARL",
        title: "Test Emergency Broadcast",
      },
    },
    {
      id: "broadcast_ended",
      label: "Broadcast Ended",
      icon: "📻",
      description: "Emergency broadcast ended",
      payload: {
        broadcastId: "test-broadcast-012",
      },
    },
    {
      id: "task_completed",
      label: "Task Completed",
      icon: "✅",
      description: "Task marked as complete",
      payload: {
        taskId: "test-task-345",
        title: "Completed Task",
        pointsEarned: 10,
        locationId: "loc-1",
      },
    },
    {
      id: "custom_notification",
      label: "Custom Notification",
      icon: "🔔",
      description: "Custom test notification",
      payload: {
        title: "Custom Test",
        message: "This is a custom test notification",
        priority: "medium",
      },
    },
  ];

  const sendNotification = async (type: string, payload: any) => {
    if (!selectedLocation || !socket) return;
    
    setIsSending(true);
    try {
      // Send via socket to specific location
      socket.emit(`test:${type}`, { locationId: selectedLocation, ...payload });
      
      // Also create a notification in the database
      await fetch("/api/notifications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedLocation,
          userType: "location",
          type: type.replace("_", "_"),
          title: payload.title || `Test: ${type}`,
          message: payload.message || `Test notification for ${type}`,
          priority: payload.priority || "medium",
          metadata: payload,
        }),
      });
    } catch (error) {
      console.error("Failed to send test notification:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted rounded-xl"
      >
        <TestTube className="h-4 w-4" />
        <span className="hidden sm:inline">Test Notifications</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4.5 w-4.5 text-[var(--hub-red)]" />
                  <h3 className="font-semibold text-foreground">Notification Tester</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Location selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Target Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notification types */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Notification Types
                </label>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {notificationTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => sendNotification(type.id, type.payload)}
                      disabled={!selectedLocation || isSending}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-lg">{type.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{type.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                      </div>
                      <Send className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>

              {isSending && (
                <div className="flex items-center justify-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--hub-red)] border-t-transparent" />
                  <span className="ml-2 text-xs text-muted-foreground">Sending...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
