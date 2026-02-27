"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, Trash2, Clock, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TickerMessage {
  id: string;
  content: string;
  icon: string;
  arlName: string;
  expiresAt: string | null;
  createdAt: string;
}

const ICONS = ["📢", "⚠️", "🎉", "🔥", "⭐", "📋", "🏆", "🔔", "💬", "🚨"];
const EXPIRY_OPTIONS = [
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "8 hours", value: 480 },
  { label: "End of day", value: null as number | null },
  { label: "No expiry", value: 0 },
];

export function TickerPush() {
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("📢");
  const [expiryOption, setExpiryOption] = useState<number | null>(60);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/ticker");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      // Calculate expiresInMinutes
      let expiresInMinutes: number | null = expiryOption;
      if (expiryOption === null) {
        // End of day: minutes until midnight
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(23, 59, 59, 0);
        expiresInMinutes = Math.floor((midnight.getTime() - now.getTime()) / 60000);
      } else if (expiryOption === 0) {
        expiresInMinutes = null;
      }

      const res = await fetch("/api/ticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, icon, expiresInMinutes }),
      });
      if (res.ok) {
        setContent("");
        setIcon("📢");
        setExpiryOption(60);
        setShowForm(false);
        fetchMessages();
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch("/api/ticker", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Never expires";
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `Expires in ${mins}m`;
    const hours = Math.floor(mins / 60);
    return `Expires in ${hours}h ${mins % 60}m`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Live Ticker</h3>
            <p className="text-[10px] text-muted-foreground">Push messages to location dashboards</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((f) => !f)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
            showForm
              ? "bg-muted text-muted-foreground"
              : "bg-[var(--hub-red)] text-white hover:bg-[#c4001f]"
          )}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "New Message"}
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              {/* Icon picker */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Icon</p>
                <div className="flex flex-wrap gap-1.5">
                  {ICONS.map((i) => (
                    <button
                      key={i}
                      onClick={() => setIcon(i)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all",
                        icon === i
                          ? "bg-[var(--hub-red)]/10 ring-2 ring-[var(--hub-red)]"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content input */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your ticker message..."
                  rows={2}
                  className="w-full rounded-xl bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-2 focus:ring-[var(--hub-red)]/50"
                  maxLength={200}
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{content.length}/200</p>
              </div>

              {/* Expiry picker */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expires</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setExpiryOption(opt.value)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        expiryOption === opt.value
                          ? "bg-[var(--hub-red)] text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {content.trim() && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <div className="flex items-center h-8 bg-card border-b border-border">
                    <div className="flex items-center gap-1.5 px-3 bg-red-600 h-full shrink-0">
                      <Zap className="h-3 w-3 text-white" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
                    </div>
                    <span className="text-xs text-white/80 font-medium px-4 truncate">
                      {icon} {content}  ⏐  by you
                    </span>
                  </div>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!content.trim() || sending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--hub-red)] py-2.5 text-sm font-semibold text-white hover:bg-[#c4001f] disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Push to All Locations"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active messages */}
      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">No active ticker messages</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <span className="text-xl shrink-0">{msg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{msg.content}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatExpiry(msg.expiresAt)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">by {msg.arlName}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(msg.id)}
                  disabled={deleting === msg.id}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
