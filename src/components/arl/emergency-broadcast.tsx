"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Send, Trash2, Radio, Eye, EyeOff, Store, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSocket } from "@/lib/socket-context";

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
  const [history, setHistory] = useState<EmergencyMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchMessage = useCallback(async () => {
    try {
      const res = await fetch("/api/emergency", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActiveMessage(data.message || null);
        setHistory(data.history || []);
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

  const { socket } = useSocket();

  useEffect(() => {
    fetchMessage();
    fetchLocations();
  }, [fetchMessage, fetchLocations]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchMessage();
    // Real-time viewed-by update: patch in-place without full refetch
    const handleViewed = (data: { messageId: string; locationId: string }) => {
      setActiveMessage((prev) => {
        if (!prev || prev.id !== data.messageId) return prev;
        if (prev.viewedBy.includes(data.locationId)) return prev;
        return { ...prev, viewedBy: [...prev.viewedBy, data.locationId] };
      });
    };
    socket.on("emergency:broadcast", handler);
    socket.on("emergency:dismissed", handler);
    socket.on("emergency:updated", handler);
    socket.on("emergency:viewed", handleViewed);
    return () => {
      socket.off("emergency:broadcast", handler);
      socket.off("emergency:dismissed", handler);
      socket.off("emergency:updated", handler);
      socket.off("emergency:viewed", handleViewed);
    };
  }, [socket, fetchMessage]);

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
          <h3 className="text-base font-bold text-foreground">Emergency Broadcast</h3>
          <p className="text-xs text-muted-foreground">Send urgent alerts to all restaurants with repeating alarm</p>
        </div>
      </div>

      {/* Active message status */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex h-20 items-center justify-center rounded-2xl border border-border bg-card">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[var(--hub-red)]" />
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
                  <p className="text-sm font-semibold text-foreground">{activeMessage.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
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
                <div className="rounded-xl bg-card/70 border border-red-500/20 p-3">
                  <button
                    onClick={() => setShowViewers((v) => !v)}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">
                        {viewed.length} / {total} viewed
                      </span>
                      {viewed.length === total && total > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">All seen</span>
                      )}
                    </div>
                    {showViewers ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
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
                              <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", l.seen ? "bg-emerald-400" : "bg-muted-foreground")} />
                              <span className={cn("text-[11px] truncate", l.seen ? "text-foreground" : "text-muted-foreground")}>
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
            className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-sm overflow-hidden px-5 py-4"
          >
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
            <p className="text-xs text-muted-foreground italic">No active emergency message</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose new message */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-muted-foreground">
          {activeMessage ? "Send New Broadcast (replaces current)" : "Compose Emergency Message"}
        </label>

        {/* Target selector */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Send to</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTargetMode("all")}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors",
                targetMode === "all"
                  ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                  : "border-border text-muted-foreground hover:bg-muted"
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
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              Select Locations
            </button>
          </div>

          {targetMode === "select" && (
            <div className="rounded-xl border border-border divide-y divide-border max-h-48 overflow-y-auto">
              {locations.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No locations found</p>
              )}
              {locations.map((loc) => {
                const selected = selectedIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    onClick={() => toggleLocation(loc.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-red-50" : "hover:bg-muted"
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      selected ? "bg-[var(--hub-red)] text-white" : "bg-muted text-muted-foreground"
                    )}>
                      <Store className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{loc.name}</p>
                      <p className="text-[10px] text-muted-foreground">Store #{loc.storeNumber}</p>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
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
                : "bg-muted text-muted-foreground"
            )}
            size="sm"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending..." : "Broadcast"}
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Emergency broadcasts immediately interrupt restaurant dashboards with a full-screen overlay and repeating audible alarm until the message is viewed. Use only for genuine emergencies.
        </p>
      </div>

      {/* Broadcast History */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Broadcast History</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{history.length}</span>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-border border-t border-border">
                  {history.map((msg) => {
                    const targets = msg.targetLocationIds ?? locations.map((l) => l.id);
                    const viewedCount = targets.filter((id) => msg.viewedBy.includes(id)).length;
                    return (
                      <div key={msg.id} className="px-5 py-3 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-foreground whitespace-pre-wrap flex-1">{msg.message}</p>
                          <span key={msg.id} className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Archived</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>By {msg.sentByName}</span>
                          <span>·</span>
                          <span>{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-2.5 w-2.5" />
                            {viewedCount}/{targets.length} viewed
                          </span>
                          {msg.targetLocationIds
                            ? <span>{msg.targetLocationIds.length} targeted</span>
                            : <span>All locations</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
