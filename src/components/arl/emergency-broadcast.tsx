"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Send, Trash2, Radio, Eye, EyeOff, Store, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Location {
  id: string;
  name: string;
  storeNumber: string;
}

interface EmergencyMessage {
  id: string;
  message: string;
  sentByName: string;
  createdAt: string;
  isActive: boolean;
  viewedBy: string[];
  targetLocationIds: string[] | null;
}

type TargetMode = "all" | "select";

export function EmergencyBroadcast() {
  const [activeMessage, setActiveMessage] = useState<EmergencyMessage | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  const fetchMessage = useCallback(async () => {
    try {
      const res = await fetch("/api/emergency", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActiveMessage(data.message || null);
      }
    } catch {}
    setLoading(false);
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchMessage();
    fetchLocations();
    const interval = setInterval(fetchMessage, 5000);
    return () => clearInterval(interval);
  }, [fetchMessage, fetchLocations]);

  const toggleLocation = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!draftMessage.trim()) return;
    if (targetMode === "select" && selectedIds.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: draftMessage.trim(),
          targetLocationIds: targetMode === "select" ? selectedIds : null,
        }),
      });
      if (res.ok) {
        setDraftMessage("");
        setSelectedIds([]);
        setTargetMode("all");
        await fetchMessage();
      }
    } catch {}
    setSending(false);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await fetch("/api/emergency", { method: "DELETE" });
      setActiveMessage(null);
    } catch {}
    setClearing(false);
  };

  // Build viewer info for active message
  const getViewerInfo = () => {
    if (!activeMessage) return { viewed: [], notViewed: [] };
    const targets = activeMessage.targetLocationIds ?? locations.map((l) => l.id);
    const viewed = targets
      .filter((id) => activeMessage.viewedBy.includes(id))
      .map((id) => locations.find((l) => l.id === id))
      .filter(Boolean) as Location[];
    const notViewed = targets
      .filter((id) => !activeMessage.viewedBy.includes(id))
      .map((id) => locations.find((l) => l.id === id))
      .filter(Boolean) as Location[];
    return { viewed, notViewed };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hub-red)]">
          <Radio className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Emergency Broadcast</h3>
          <p className="text-xs text-slate-400">Send an urgent message to restaurant locations</p>
        </div>
      </div>

      {/* Active message status */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex h-20 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
          </div>
        ) : activeMessage ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="rounded-2xl border-2 border-[var(--hub-red)] bg-red-50 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-red)]"
                >
                  <AlertTriangle className="h-4 w-4 text-white" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--hub-red)]">Active Broadcast</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--hub-red)] animate-pulse" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{activeMessage.message}</p>
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    Sent by {activeMessage.sentByName} · {format(new Date(activeMessage.createdAt), "MMM d, h:mm a")}
                    {activeMessage.targetLocationIds
                      ? ` · ${activeMessage.targetLocationIds.length} location${activeMessage.targetLocationIds.length !== 1 ? "s" : ""} targeted`
                      : " · All locations"}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleClear}
                disabled={clearing}
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl border-[var(--hub-red)] text-[var(--hub-red)] hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {clearing ? "Clearing..." : "Clear"}
              </Button>
            </div>

            {/* View tracking */}
            {(() => {
              const { viewed, notViewed } = getViewerInfo();
              const total = viewed.length + notViewed.length;
              return (
                <div className="rounded-xl bg-white/70 border border-red-200 p-3">
                  <button
                    onClick={() => setShowViewers((v) => !v)}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700">
                        {viewed.length} / {total} viewed
                      </span>
                      {viewed.length === total && total > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">All seen</span>
                      )}
                    </div>
                    {showViewers ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </button>
                  <AnimatePresence>
                    {showViewers && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {[...viewed.map((l) => ({ ...l, seen: true })), ...notViewed.map((l) => ({ ...l, seen: false }))].map((l) => (
                            <div key={l.id} className="flex items-center gap-1.5 py-0.5">
                              <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", l.seen ? "bg-emerald-400" : "bg-slate-300")} />
                              <span className={cn("text-[11px] truncate", l.seen ? "text-slate-700" : "text-slate-400")}>
                                {l.name}
                              </span>
                              {l.seen && <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" />}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}
          </motion.div>
        ) : (
          <motion.div
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4"
          >
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <p className="text-sm text-slate-400">No active emergency broadcast</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose new message */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-600">
          {activeMessage ? "Send New Broadcast (replaces current)" : "Compose Emergency Message"}
        </label>

        {/* Target selector */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Send to</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTargetMode("all")}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors",
                targetMode === "all"
                  ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              All Locations
            </button>
            <button
              onClick={() => setTargetMode("select")}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors",
                targetMode === "select"
                  ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              Select Locations
            </button>
          </div>

          {targetMode === "select" && (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {locations.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">No locations found</p>
              )}
              {locations.map((loc) => {
                const selected = selectedIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    onClick={() => toggleLocation(loc.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-red-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      selected ? "bg-[var(--hub-red)] text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      <Store className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{loc.name}</p>
                      <p className="text-[10px] text-slate-400">Store #{loc.storeNumber}</p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-[var(--hub-red)]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <textarea
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          placeholder="Type your emergency message here..."
          rows={3}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            {targetMode === "all"
              ? "Will alert all locations with repeating alarm."
              : selectedIds.length === 0
              ? "Select at least one location."
              : `${selectedIds.length} location${selectedIds.length !== 1 ? "s" : ""} selected.`}
          </p>
          <Button
            onClick={handleSend}
            disabled={!draftMessage.trim() || sending || (targetMode === "select" && selectedIds.length === 0)}
            className={cn(
              "gap-1.5 rounded-xl",
              draftMessage.trim() && (targetMode === "all" || selectedIds.length > 0)
                ? "bg-[var(--hub-red)] hover:bg-[#c4001f]"
                : "bg-slate-200 text-slate-400"
            )}
            size="sm"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending..." : "Broadcast"}
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
        <p className="text-xs text-amber-700">
          Emergency broadcasts immediately interrupt restaurant dashboards with a full-screen overlay and repeating audible alarm until the message is viewed. Use only for genuine emergencies.
        </p>
      </div>
    </div>
  );
}
