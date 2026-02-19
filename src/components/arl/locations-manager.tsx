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
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
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
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    loc.isOnline ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  )}
                >
                  <Store className="h-5 w-5" />
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
              {loc.lastSeen && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    Last seen {formatDistanceToNow(new Date(loc.lastSeen), { addSuffix: true })}
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
