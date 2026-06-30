"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TestTube, Send, ChevronDown, CheckCircle2 } from "@/lib/icons";
import { Select, SelectTrigger, SelectValueText, SelectContent, SelectItem, createListCollection } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";

interface NotificationTesterProps {
  className?: string;
}

interface LocationOption {
  id: string;
  name: string;
  storeNumber: string;
  isOnline: boolean;
}

export function NotificationTester({ className }: NotificationTesterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentType, setSentType] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const locationOptions = useMemo(() => createListCollection({
    items: [
      { value: "", label: "Select a location..." },
      ...locations.map((loc) => ({
        value: loc.id,
        label: `${loc.storeNumber ? `#${loc.storeNumber} - ` : ""}${loc.name}${loc.isOnline ? " (Online)" : ""}`,
      })),
    ],
  }), [locations]);
  const { socket } = useSocket();

  // Fetch real locations from API
  useEffect(() => {
    if (isOpen && locations.length === 0) {
      setLoadingLocations(true);
      fetch("/api/locations")
        .then((res) => res.json())
        .then((data) => {
          const locs = (data.locations || []).map((loc: any) => ({
            id: loc.id,
            name: loc.name || loc.storeNumber || "Unknown",
            storeNumber: loc.storeNumber || "",
            isOnline: loc.isOnline || false,
          }));
          setLocations(locs);
        })
        .catch((err) => console.error("Failed to fetch locations:", err))
        .finally(() => setLoadingLocations(false));
    }
  }, [isOpen, locations.length]);

  const notificationTypes = [
    {
      id: "task_due_soon",
      label: "Task Due Soon",
      icon: "\u23F0",
      description: "Task is approaching due time",
      payload: {
        taskId: "test-task-123",
        title: "Test Task - Due Soon",
        dueTime: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    },
    {
      id: "task_overdue",
      label: "Task Overdue",
      icon: "\u26A0\uFE0F",
      description: "Task is past due time",
      payload: {
        taskId: "test-task-456",
        title: "Overdue Test Task",
        dueTime: new Date(Date.now() - 30 * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    },
    {
      id: "task_completed",
      label: "Task Completed",
      icon: "\u2705",
      description: "Task marked as complete",
      payload: {
        taskId: "test-task-345",
        title: "Completed Test Task",
      },
    },
    {
      id: "meeting_started",
      label: "Meeting Started",
      icon: "\uD83D\uDCF9",
      description: "New meeting has started",
      payload: {
        meetingId: "test-meeting-789",
        title: "Test Meeting",
        hostName: "Test ARL",
        hostId: "test-host",
      },
    },
    {
      id: "meeting_ended",
      label: "Meeting Ended",
      icon: "\uD83D\uDD1A",
      description: "Meeting has ended",
      payload: {
        meetingId: "test-meeting-789",
        reason: "completed",
      },
    },
    {
      id: "broadcast_started",
      label: "Broadcast Started",
      icon: "\uD83D\uDCE2",
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
      icon: "\uD83D\uDCFB",
      description: "Emergency broadcast ended",
      payload: {
        broadcastId: "test-broadcast-012",
      },
    },
    {
      id: "custom_notification",
      label: "Custom Notification",
      icon: "\uD83D\uDD14",
      description: "Custom test notification",
      payload: {
        title: "Custom Test",
        message: "This is a custom test notification from the ARL Hub",
        priority: "medium",
      },
    },
  ];

  const sendNotification = async (type: string, payload: Record<string, unknown>) => {
    if (!selectedLocation || !socket) return;
    
    setIsSending(true);
    setSentType(null);
    try {
      // Inject the selected locationId into task_completed payload
      const enrichedPayload = { ...payload };
      if (type === "task_completed") {
        enrichedPayload.locationId = selectedLocation;
      }

      // Send via socket to specific location
      socket.emit(`test:${type}`, { locationId: selectedLocation, ...enrichedPayload });
      
      setSentType(type);
      setTimeout(() => setSentType(null), 2000);
    } catch (error) {
      console.error("Failed to send test notification:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={cn("", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors active:bg-muted rounded-xl w-full"
      >
        <TestTube className="h-4 w-4" />
        <span>Test Notifications</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform ml-auto", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              {/* Location selector */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  Target Location
                </label>
                {loadingLocations ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent" />
                    Loading locations...
                  </div>
                ) : (
                  <Select
                    collection={locationOptions}
                    value={[selectedLocation]}
                    onValueChange={(d) => setSelectedLocation(d.value[0])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValueText />
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.items.map((item) => (
                        <SelectItem key={item.value} item={item}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {locations.length === 0 && !loadingLocations && (
                  <p className="text-xs text-muted-foreground mt-1">No locations found. Create locations in the Locations page first.</p>
                )}
              </div>

              {/* Notification types */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Send Notification ({notificationTypes.length} types)
                </label>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {notificationTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => sendNotification(type.id, type.payload)}
                      disabled={!selectedLocation || isSending}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl border border-border active:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-lg">{type.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{type.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                      </div>
                      {sentType === type.id ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Send className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
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
