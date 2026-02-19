"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Store,
  Wifi,
  WifiOff,
  Clock,
  MapPin,
  Mail,
  Monitor,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "@/lib/socket-context";

interface LocationWithStatus {
  id: string;
  name: string;
  storeNumber: string;
  address: string | null;
  email: string | null;
  userId: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeen: string | null;
  deviceType: string | null;
  soundMuted: boolean;
}

export function LocationsManager() {
  const [locations, setLocations] = useState<LocationWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations);
      }
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSoundToggle = async (loc: LocationWithStatus) => {
    const next = !loc.soundMuted;
    setTogglingId(loc.id);
    // Optimistic update
    setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, soundMuted: next } : l));
    try {
      await fetch("/api/locations/sound", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, muted: next }),
      });
    } catch {
      // Revert on failure
      setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, soundMuted: loc.soundMuted } : l));
    } finally {
      setTogglingId(null);
    }
  };

  const { socket } = useSocket();

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (!socket) return;
    const handlePresence = () => fetchLocations();
    const handleSoundUpdate = (data: { locationId: string; muted: boolean }) => {
      setLocations((prev) => prev.map((l) =>
        l.id === data.locationId ? { ...l, soundMuted: data.muted } : l
      ));
    };
    socket.on("presence:update", handlePresence);
    socket.on("location:sound-toggle", handleSoundUpdate);
    return () => {
      socket.off("presence:update", handlePresence);
      socket.off("location:sound-toggle", handleSoundUpdate);
    };
  }, [socket, fetchLocations]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-40 rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} /></div>
            <div className="h-3 w-24 rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }} /></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                  <motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} /></div>
                  <div className="h-3 w-16 rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.1 }} /></div>
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.15 }} /></div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.2 }} /></div>
                <div className="h-3 w-3/4 rounded-full bg-slate-200 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.25 }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const onlineCount = locations.filter((l) => l.isOnline).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Restaurant Locations</h3>
          <p className="text-xs text-slate-400">
            {onlineCount} of {locations.length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-700">{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-[11px] font-medium text-slate-500">{locations.length - onlineCount} Offline</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {locations.map((loc, i) => (
          <motion.div
            key={loc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
              loc.isOnline ? "border-emerald-200" : "border-slate-200"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  {loc.isOnline && [0, 1].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-xl border-2 border-emerald-400"
                      initial={{ width: 40, height: 40, opacity: 0.6 }}
                      animate={{ width: 64, height: 64, opacity: 0 }}
                      transition={{ duration: 1.8, delay: i * 0.9, repeat: Infinity, ease: "easeOut" }}
                    />
                  ))}
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    loc.isOnline ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  )}>
                    <Store className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{loc.name}</h4>
                  <p className="text-xs text-slate-400">Store #{loc.storeNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Sound mute toggle */}
                <button
                  onClick={() => handleSoundToggle(loc)}
                  disabled={togglingId === loc.id}
                  title={loc.soundMuted ? "Audio muted — click to unmute" : "Audio on — click to mute"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    loc.soundMuted
                      ? "bg-red-50 text-red-400 hover:bg-red-100"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                    togglingId === loc.id && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {loc.soundMuted
                    ? <VolumeX className="h-3.5 w-3.5" />
                    : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px]",
                    loc.isOnline
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {loc.isOnline ? (
                    <span className="flex items-center gap-1">
                      <Wifi className="h-2.5 w-2.5" /> Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <WifiOff className="h-2.5 w-2.5" /> Offline
                    </span>
                  )}
                </Badge>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {loc.address && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{loc.address}</span>
                </div>
              )}
              {loc.email && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{loc.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Monitor className="h-3 w-3 shrink-0" />
                <span>User ID: {loc.userId}</span>
              </div>
              {(loc.isOnline || loc.lastSeen) && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    {loc.isOnline
                      ? "Active now"
                      : loc.lastSeen
                        ? `Last seen ${formatDistanceToNow(new Date(loc.lastSeen), { addSuffix: true })}`
                        : null}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
