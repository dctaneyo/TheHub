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
  KeyRound,
  Check,
  X,
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
  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

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

  const handlePinReset = async (locId: string) => {
    if (newPin.length !== 6) { setPinError("PIN must be 6 digits"); return; }
    if (!/^\d{6}$/.test(newPin)) { setPinError("PIN must be digits only"); return; }
    setPinSaving(true);
    setPinError("");
    try {
      const res = await fetch("/api/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: locId, pin: newPin }),
      });
      if (res.ok) {
        setPinSuccess(locId);
        setResetPinId(null);
        setNewPin("");
        setTimeout(() => setPinSuccess(null), 3000);
      } else {
        const d = await res.json();
        setPinError(d.error || "Failed to reset PIN");
      }
    } catch { setPinError("Network error"); }
    setPinSaving(false);
  };

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
            <div className="h-4 w-40 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} /></div>
            <div className="h-3 w-24 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }} /></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted overflow-hidden shrink-0">
                  <motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} /></div>
                  <div className="h-3 w-16 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.1 }} /></div>
                </div>
                <div className="h-6 w-16 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.15 }} /></div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.2 }} /></div>
                <div className="h-3 w-3/4 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.25 }} /></div>
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
          <h3 className="text-base font-bold text-foreground">Restaurant Locations</h3>
          <p className="text-xs text-muted-foreground">
            {onlineCount} of {locations.length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">{locations.length - onlineCount} Offline</span>
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
              "rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
              loc.isOnline ? "border-emerald-200 dark:border-emerald-800" : "border-border"
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
                    loc.isOnline ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                  )}>
                    <Store className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{loc.name}</h4>
                  <p className="text-xs text-muted-foreground">Store #{loc.storeNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* PIN reset button */}
                <button
                  onClick={() => { setResetPinId(resetPinId === loc.id ? null : loc.id); setNewPin(""); setPinError(""); }}
                  title="Reset login PIN"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    resetPinId === loc.id
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                      : pinSuccess === loc.id
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {pinSuccess === loc.id ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                </button>
                {/* Sound mute toggle */}
                <button
                  onClick={() => handleSoundToggle(loc)}
                  disabled={togglingId === loc.id}
                  title={loc.soundMuted ? "Audio muted — click to unmute" : "Audio on — click to mute"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    loc.soundMuted
                      ? "bg-red-50 text-red-400 hover:bg-red-100 dark:bg-red-950 dark:text-red-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
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
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{loc.address}</span>
                </div>
              )}
              {loc.email && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{loc.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Monitor className="h-3 w-3 shrink-0" />
                <span>User ID: {loc.userId}</span>
              </div>
              {(loc.isOnline || loc.lastSeen) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
              {/* Inline PIN reset form */}
              {resetPinId === loc.id && (
                <div className="mt-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <KeyRound className="h-3 w-3" />
                    Reset 6-digit PIN
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
                      placeholder="New PIN (6 digits)"
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-amber-400/50"
                    />
                    <button
                      onClick={() => handlePinReset(loc.id)}
                      disabled={pinSaving || newPin.length !== 6}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setResetPinId(null); setNewPin(""); setPinError(""); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {pinError && <p className="text-[10px] text-red-500">{pinError}</p>}
                </div>
              )}
              {pinSuccess === loc.id && (
                <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> PIN reset successfully
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
