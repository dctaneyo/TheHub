"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { Avatar, AvatarFallback, AvatarBadge } from "@/components/ui/avatar";

/**
 * Messages widget for the GRID dashboard only — shows a live preview list of
 * conversations (latest message + unread) instead of a single launcher button.
 * Tapping anywhere opens the full chat overlay (unchanged on the classic route).
 */

interface Conversation {
  id: string;
  type: string;
  name: string;
  subtitle: string;
  lastMessage: {
    content: string;
    createdAt: string;
    senderType: string;
    senderName: string;
  } | null;
  unreadCount: number;
  memberCount: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function GridMessagesWidget({
  onOpen,
}: {
  onOpen: (conversationId?: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchData = useCallback(() => {
    fetch("/api/messages")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.conversations) setConversations(json.conversations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live refresh on message activity
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchData();
    socket.on("message:new", handler);
    socket.on("message:read", handler);
    socket.on("conversation:update", handler);
    return () => {
      socket.off("message:new", handler);
      socket.off("message:read", handler);
      socket.off("conversation:update", handler);
    };
  }, [socket, fetchData]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header — tapping it navigates to /messages, same as every other
          widget header now does; the chevron is the visible signifier,
          replacing the old floating corner Expand button. */}
      <button
        type="button"
        onClick={() => onOpen()}
        className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3 text-left transition-colors active:bg-muted/60"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Messages</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-2 text-xs font-semibold text-destructive-foreground">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </button>

      {/* Conversation list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No conversations</p>
          </div>
        ) : (
          conversations.map((c) => {
            const unread = c.unreadCount > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpen(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors active:bg-muted/80",
                  unread && "bg-primary/5"
                )}
              >
                <Avatar className="size-11 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {c.type === "global" ? (
                      <MessageCircle className="h-5 w-5" />
                    ) : (
                      initials(c.name)
                    )}
                  </AvatarFallback>
                  {unread && <AvatarBadge className="bg-destructive ring-card" />}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        unread
                          ? "font-semibold text-foreground"
                          : "font-semibold text-foreground"
                      )}
                    >
                      {c.name}
                    </span>
                    {c.lastMessage && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(c.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "truncate text-sm",
                      unread
                        ? "font-semibold text-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {c.lastMessage
                      ? `${c.lastMessage.senderName ? c.lastMessage.senderName + ": " : ""}${c.lastMessage.content}`
                      : c.subtitle || "No messages yet"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
