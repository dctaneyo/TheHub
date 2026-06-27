"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import { MessageCircle, Globe, Users, Store, Send } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { SubPageHeader } from "@/components/sub-page-header";
import type { Message, Conversation } from "@/components/dashboard/restaurant-chat";

/**
 * Full Messages — macOS Messages-style: thread list always visible on the
 * left, active thread on the right, no navigating into a thread and losing
 * the list (the dashboard widget's overlay can only show one or the other).
 *
 * v1 scope is plain text messaging + read state, reusing the same
 * /api/messages endpoints and message:new/message:read/conversation:updated
 * socket events as the dashboard's RestaurantChat. Deliberately deferred:
 * voice messages, reactions, mentions, group-chat creation, in-thread
 * search, mute — RestaurantChat is a large (1100+ line), already-working,
 * tightly-coupled-to-its-overlay-UI component, and replicating every one of
 * its features here in one pass would be a much bigger and riskier change
 * than this route actually needs to be useful. Those can follow as their
 * own pass once this core is confirmed solid.
 */

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
  const { socket } = useSocket();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(searchParams.get("thread"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!socket) return;
    const onConvoUpdate = () => fetchConversations();
    const onNewMessage = (data: { conversationId: string }) => {
      fetchConversations();
      if (activeId && data.conversationId === activeId) fetchMessages(activeId);
    };
    socket.on("conversation:updated", onConvoUpdate);
    socket.on("message:new", onNewMessage);
    socket.on("message:read", onConvoUpdate);
    return () => {
      socket.off("conversation:updated", onConvoUpdate);
      socket.off("message:new", onNewMessage);
      socket.off("message:read", onConvoUpdate);
    };
  }, [socket, activeId, fetchConversations, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setDraft("");
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

  const activeConvo = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <SubPageHeader title="Messages" icon={MessageCircle} currentPath="/messages" />
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
                    "flex items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors active:bg-muted/80",
                    isActive && "bg-muted",
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
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[70%] rounded-2xl px-3 py-2",
                        mine ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted text-foreground"
                      )}
                    >
                      {!mine && (
                        <p className="text-xs font-semibold opacity-70">{m.senderName}</p>
                      )}
                      <p className="text-sm">{m.content}</p>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder="Message..."
                  className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleSend}
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
