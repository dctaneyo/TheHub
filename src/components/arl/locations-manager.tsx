"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
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
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { IconTip } from "@/components/ui/icon-tip";
import { StatusDot } from "@/components/ui/status-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
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

/**
 * Real table, not a card grid — locations are 8 same-shaped fields per
 * record (status, address, email, user ID, last-seen, store#) that a user
 * wants to scan/compare across, the textbook Section 11 case. The previous
 * card-grid version required reading every card individually to answer
 * "which locations haven't checked in" instead of scanning one column.
 * Desktop gets a real <table>; mobile gets a stacked card fallback —
 * mirroring the pattern this codebase already uses for meeting
 * participants (meeting-analytics.tsx), not a new one-off.
 */
export function LocationsManager() {
  const [locations, setLocations] = useState<LocationWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [listError, setListError] = useState("");

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
    if (newPin.length !== 4) { setPinError("PIN must be 4 digits"); return; }
    if (!/^\d{4}$/.test(newPin)) { setPinError("PIN must be digits only"); return; }
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
      const res = await fetch("/api/locations/sound", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, muted: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, soundMuted: loc.soundMuted } : l));
      setListError(`Failed to update sound setting for ${loc.name}`);
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
          <div className="space-y-2">
            <div className="h-4 w-40 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} /></div>
            <div className="h-3 w-24 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }} /></div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
              <div className="h-8 w-8 rounded-lg bg-muted overflow-hidden shrink-0">
                <motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} />
              </div>
              <div className="h-3.5 flex-1 max-w-48 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} /></div>
              <div className="h-5 w-16 rounded-full bg-muted overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-muted via-card to-muted" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.15 }} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const onlineCount = locations.filter((l) => l.isOnline).length;

  const PinResetRow = ({ loc }: { loc: LocationWithStatus }) => (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
      <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={newPin}
        onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
        placeholder="New 4-digit PIN"
        autoFocus
        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-amber-400/50"
      />
      <button
        onClick={() => handlePinReset(loc.id)}
        disabled={pinSaving || newPin.length !== 4}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => { setResetPinId(null); setNewPin(""); setPinError(""); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {pinError && <p className="shrink-0 text-xs text-red-500">{pinError}</p>}
    </div>
  );

  const RowActions = ({ loc }: { loc: LocationWithStatus }) => (
    <div className="flex items-center justify-end gap-1">
      <IconTip label="Reset login PIN">
        <button
          onClick={() => { setResetPinId(resetPinId === loc.id ? null : loc.id); setNewPin(""); setPinError(""); }}
          title="Reset login PIN"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            resetPinId === loc.id
              ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
              : pinSuccess === loc.id
              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted"
          )}
        >
          {pinSuccess === loc.id ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
        </button>
      </IconTip>
      <IconTip label={loc.soundMuted ? "Audio muted — click to unmute" : "Audio on — click to mute"}>
        <button
          onClick={() => handleSoundToggle(loc)}
          disabled={togglingId === loc.id}
          title={loc.soundMuted ? "Audio muted — click to unmute" : "Audio on — click to mute"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            loc.soundMuted
              ? "bg-red-50 text-red-400 hover:bg-red-100 active:bg-red-100 dark:bg-red-950 dark:text-red-400"
              : "bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted",
            togglingId === loc.id && "opacity-50 cursor-not-allowed"
          )}
        >
          {loc.soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </IconTip>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Restaurant Locations</h3>
          <p className="text-xs text-muted-foreground">
            {onlineCount} of {locations.length} online
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1">
            <StatusDot color="emerald" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1">
            <StatusDot color="muted" />
            <span className="text-xs font-semibold text-muted-foreground">{locations.length - onlineCount} Offline</span>
          </div>
        </div>
      </div>

      {listError && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {listError}
          <ModalCloseButton onClick={() => setListError("")} className="h-6 w-6 text-red-600 dark:text-red-400 active:bg-red-500/10" />
        </div>
      )}

      {/* Table — desktop */}
      <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Location</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Address</th>
                <th className="px-4 py-2.5 text-left font-semibold">Email</th>
                <th className="px-4 py-2.5 text-left font-semibold">User ID</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <Fragment key={loc.id}>
                  <tr className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          loc.isOnline ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                        )}>
                          <Store className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{loc.name}</p>
                          <p className="text-xs text-muted-foreground">#{loc.storeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {loc.isOnline ? (
                          <>
                            <Wifi className="h-3 w-3 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Online</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Offline</span>
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>
                          {loc.isOnline ? "Active now" : loc.lastSeen ? `${formatDistanceToNow(new Date(loc.lastSeen), { addSuffix: true })}` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-48 px-4 py-3">
                      {loc.address ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{loc.address}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-40 px-4 py-3">
                      {loc.email ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{loc.email}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Monitor className="h-3 w-3 shrink-0" />
                        {loc.userId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActions loc={loc} />
                    </td>
                  </tr>
                  {(resetPinId === loc.id || pinSuccess === loc.id) && (
                    <tr className="border-b border-border last:border-b-0">
                      <td colSpan={6} className="px-4 py-3">
                        {resetPinId === loc.id ? (
                          <PinResetRow loc={loc} />
                        ) : (
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="h-3 w-3" /> PIN reset successfully
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No locations yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards — mobile, same data, stacked */}
      <div className="md:hidden space-y-2">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className={cn(
              "rounded-2xl border bg-card p-4",
              loc.isOnline ? "border-emerald-200 dark:border-emerald-800" : "border-border"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  loc.isOnline ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}>
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">Store #{loc.storeNumber}</p>
                </div>
              </div>
              <RowActions loc={loc} />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {loc.isOnline ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3" />}
                <span className={loc.isOnline ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
                  {loc.isOnline ? "Online — active now" : loc.lastSeen ? `Last seen ${formatDistanceToNow(new Date(loc.lastSeen), { addSuffix: true })}` : "Offline"}
                </span>
              </div>
              {loc.address && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{loc.address}</span>
                </div>
              )}
              {loc.email && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{loc.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Monitor className="h-3 w-3 shrink-0" />User ID: {loc.userId}
              </div>
            </div>
            {resetPinId === loc.id && <div className="mt-3"><PinResetRow loc={loc} /></div>}
            {pinSuccess === loc.id && (
              <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> PIN reset successfully
              </p>
            )}
          </div>
        ))}
        {locations.length === 0 && (
          <EmptyState title="No locations yet" className="py-8" />
        )}
      </div>
    </div>
  );
}
