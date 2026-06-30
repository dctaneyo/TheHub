"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import { MessageCircle, Globe, Users, Store, Send, Keyboard, Check, CheckCheck, Smile } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import { Emoji } from "@/components/ui/emoji";
import { EmojiQuickReplies } from "@/components/emoji-quick-replies";
import type { Message, Conversation } from "@/components/dashboard/restaurant-chat";

/**
 * Full Messages — macOS Messages-style: thread list always visible on the
 * left, active thread on the right, no navigating into a thread and losing
 * the list (the dashboard widget's overlay can only show one or the other).
 *
 * Brought to feature parity with the dashboard's RestaurantChat overlay
 * (typing indicators, timestamps, reactions, quick replies) on 2026-06-30 —
 * the v1 scope note that used to live here ("deliberately deferred") is
 * gone because that pass happened. Still intentionally not ported: voice
 * messages, @mentions, group-chat creation, in-thread search, mute — those
 * remain genuinely separate features, not a contiguous "do the rest of
 * RestaurantChat" scope.
 */

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😊"];

function ConvoIcon({ type }: { type: Conversation["type"] }) {
  if (type === "global") return <Globe className="h-5 w-5" />;
  if (type === "group") return <Users className="h-5 w-5" />;
  return <Store className="h-5 w-5" />;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const { user } = useAuth();
  const { socket, joinConversation, leaveConversation, startTyping, stopTyping } = useSocket();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(searchParams.get("thread"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const outgoingTypingTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) setConversations((await res.json()).conversations || []);
    } catch { /* keep last-known list */ }
  }, []);

  const fetchMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/messages?conversationId=${id}`);
      if (res.ok) setMessages((await res.json()).messages || []);
    } catch { /* keep last-known messages */ }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (activeId) fetchMessages(activeId); else setMessages([]); }, [activeId, fetchMessages]);

  // Join/leave the conversation's socket room so typing events for this
  // thread reach us — same lifecycle as RestaurantChat.
  useEffect(() => {
    if (!activeId) return;
    joinConversation(activeId);
    setTypingUsers(new Map());
    return () => leaveConversation(activeId);
  }, [activeId, joinConversation, leaveConversation]);

  useEffect(() => {
    if (!socket) return;
    const onConvoUpdate = () => fetchConversations();
    const onNewMessage = (data: { conversationId: string }) => {
      fetchConversations();
      if (activeId && data.conversationId === activeId) fetchMessages(activeId);
    };
    const onTypingStart = (data: { conversationId: string; userId: string; userName: string }) => {
      if (data.conversationId !== activeId) return;
      setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
      const existing = typingTimeouts.current.get(data.userId);
      if (existing) clearTimeout(existing);
      typingTimeouts.current.set(data.userId, setTimeout(() => {
        setTypingUsers((prev) => { const next = new Map(prev); next.delete(data.userId); return next; });
      }, 3000));
    };
    const onTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => { const next = new Map(prev); next.delete(data.userId); return next; });
    };
    socket.on("conversation:updated", onConvoUpdate);
    socket.on("message:new", onNewMessage);
    socket.on("message:read", onConvoUpdate);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    return () => {
      socket.off("conversation:updated", onConvoUpdate);
      socket.off("message:new", onNewMessage);
      socket.off("message:read", onConvoUpdate);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
    };
  }, [socket, activeId, fetchConversations, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeId) return;
    startTyping(activeId);
    if (outgoingTypingTimer.current) clearTimeout(outgoingTypingTimer.current);
    outgoingTypingTimer.current = setTimeout(() => stopTyping(activeId), 2000);
  };

  const handleSend = async (directContent?: string) => {
    const content = (directContent ?? draft).trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    if (!directContent) setDraft("");
    if (outgoingTypingTimer.current) clearTimeout(outgoingTypingTimer.current);
    stopTyping(activeId);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, content }),
      });
      await Promise.all([fetchMessages(activeId), fetchConversations()]);
    } finally {
      setSending(false);
    }
  };

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    setShowReactions(null);
    try {
      const res = await fetch("/api/messages/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      if (res.ok && activeId) fetchMessages(activeId);
    } catch { /* reaction is non-critical, fail silently */ }
  }, [activeId, fetchMessages]);

  const activeConvo = conversations.find((c) => c.id === activeId) ?? null;
  const typingNames = Array.from(typingUsers.values());

  return (
    <div className="flex h-screen flex-col bg-card">
      <AppHeader title="Messages" icon={MessageCircle} backHref="/dashboard" currentPath="/messages" />
      <div className="flex min-h-0 flex-1">
        {/* Thread list — always visible, never replaced by the active thread */}
        <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-border">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeId;
              const unread = c.unreadCount > 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex items-center gap-3 border-b border-l-2 border-border/40 px-3 py-3 text-left transition-colors active:bg-muted/80",
                    isActive ? "border-l-primary bg-muted" : "border-l-transparent",
                    unread && !isActive && "bg-primary/5"
                  )}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ConvoIcon type={c.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                      {c.lastMessage && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.lastMessage.createdAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage?.content ?? c.subtitle}
                    </p>
                  </div>
                  {unread && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Active thread */}
        <div className="flex min-h-0 flex-1 flex-col">
          {!activeConvo ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
                <span className="text-sm font-semibold text-foreground">{activeConvo.name}</span>
                <span className="text-xs text-muted-foreground">{activeConvo.subtitle}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  const hasBeenRead = m.reads.length > 0;
                  return (
                    <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-3 py-2",
                          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-muted text-foreground"
                        )}
                      >
                        {!mine && (
                          <p className="text-xs font-semibold opacity-70">{m.senderName}</p>
                        )}
                        <p className="text-sm">{m.content}</p>

                        {m.reactions && m.reactions.length > 0 && (() => {
                          const grouped = m.reactions.reduce((acc, r) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          return (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(grouped).map(([emoji, count]) => (
                                <div
                                  key={emoji}
                                  className={cn(
                                    "flex items-center gap-1 rounded-full px-2 py-1",
                                    mine ? "bg-white/20" : "bg-card border border-border"
                                  )}
                                >
                                  <Emoji emoji={emoji} size={14} />
                                  {count > 1 && (
                                    <span className={cn("text-xs font-semibold", mine ? "text-white/80" : "text-muted-foreground")}>
                                      {count}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        <div className={cn("mt-1 flex flex-wrap items-center gap-1", mine ? "justify-end" : "justify-start")}>
                          <span className={cn("text-xs", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {format(new Date(m.createdAt), "h:mm a")}
                          </span>
                          {mine && (hasBeenRead
                            ? <CheckCheck className="h-3 w-3 text-primary-foreground/80" />
                            : <Check className="h-3 w-3 text-primary-foreground/50" />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowReactions(showReactions === m.id ? null : m.id)}
                            className={cn("transition-opacity active:opacity-70", mine ? "text-primary-foreground/60" : "text-muted-foreground")}
                            title="Add reaction"
                          >
                            <Smile className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {showReactions === m.id && (
                        <div className="mt-1 flex gap-1 rounded-full border border-border bg-card px-2 py-2 shadow-lg">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => addReaction(m.id, emoji)}
                              className="active:scale-125 transition-transform"
                            >
                              <Emoji emoji={emoji} size={24} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {typingNames.length > 0 && (
                  <div className="flex items-center gap-2 px-2">
                    <div className="flex gap-1">
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames.join(", ")} are typing...`}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {showKeyboard && (
                <OnscreenKeyboard
                  value={draft}
                  onChange={handleDraftChange}
                  onSubmit={draft.trim() && !sending ? () => handleSend() : undefined}
                  onDismiss={() => setShowKeyboard(false)}
                  placeholder="Message..."
                />
              )}
              {!showKeyboard && (
                <div className="px-3 pt-3">
                  <EmojiQuickReplies onSelect={(text) => handleSend(text)} />
                </div>
              )}
              <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
                <button
                  type="button"
                  onClick={() => setShowKeyboard((k) => !k)}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    showKeyboard
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground active:bg-muted/80"
                  )}
                  title="Onscreen keyboard"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
                <input
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder="Message..."
                  className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!draft.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
