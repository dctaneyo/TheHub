"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  ArrowLeft,
  CheckCheck,
  Check,
  Store,
  MessageCircle,
  Globe,
  Users,
  Plus,
  X,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  type: "direct" | "global" | "group";
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
  members?: Array<{ memberId: string; memberType: string }>;
}

interface Message {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: string;
  createdAt: string;
  reads: Array<{ readerType: string; readerId: string; readAt: string }>;
}

interface MemberInfo {
  id: string;
  name: string;
  type: "location" | "arl";
}

type ConvType = "direct" | "global" | "group";

interface NewGroupState {
  name: string;
  memberIds: string[];
  memberTypes: string[];
}

interface Participant {
  id: string;
  name: string;
  type: "location" | "arl";
  storeNumber?: string;
}

function convIcon(type: ConvType) {
  if (type === "global") return <Globe className="h-5 w-5" />;
  if (type === "group") return <Users className="h-5 w-5" />;
  return <Store className="h-5 w-5" />;
}

function convIconBg(type: ConvType) {
  if (type === "global") return "bg-blue-100 text-blue-600";
  if (type === "group") return "bg-purple-100 text-purple-600";
  return "bg-slate-100 text-slate-500";
}

export function Messaging() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newGroup, setNewGroup] = useState<NewGroupState>({ name: "", memberIds: [], memberTypes: [] });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [memberInfoMap, setMemberInfoMap] = useState<Map<string, MemberInfo>>(new Map());
  const [receiptPopover, setReceiptPopover] = useState<string | null>(null); // message id
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [directSearch, setDirectSearch] = useState("");
  const [startingDirect, setStartingDirect] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevUnreadRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const playMessageChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      // Two soft ascending tones
      [[660, 0, 0.12], [880, 0.15, 0.12]].forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur);
      });
    } catch {}
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const convs: Conversation[] = data.conversations;
        const newTotal = convs.reduce((s, c) => s + c.unreadCount, 0);
        // Only chime for messages that arrive after the initial load
        if (initializedRef.current && newTotal > prevUnreadRef.current) {
          playMessageChime();
        }
        prevUnreadRef.current = newTotal;
        initializedRef.current = true;
        setConversations(convs);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [playMessageChime]);

  const fetchMemberInfo = useCallback(async () => {
    try {
      const [locRes, arlRes] = await Promise.all([
        fetch("/api/locations"),
        fetch("/api/arls"),
      ]);
      const map = new Map<string, MemberInfo>();
      if (locRes.ok) {
        const d = await locRes.json();
        for (const l of d.locations || []) map.set(l.id, { id: l.id, name: l.name, type: "location" });
      }
      if (arlRes.ok) {
        const d = await arlRes.json();
        for (const a of d.arls || []) map.set(a.id, { id: a.id, name: a.name, type: "arl" });
      }
      setMemberInfoMap(map);
    } catch {}
  }, []);

  const fetchParticipants = useCallback(async () => {
    try {
      const [locRes, arlRes] = await Promise.all([
        fetch("/api/locations"),
        fetch("/api/arls"),
      ]);
      const parts: Participant[] = [];
      if (locRes.ok) {
        const d = await locRes.json();
        for (const l of d.locations || []) parts.push({ id: l.id, name: l.name, type: "location", storeNumber: l.storeNumber });
      }
      if (arlRes.ok) {
        const d = await arlRes.json();
        for (const a of d.arls || []) parts.push({ id: a.id, name: a.name, type: "arl" });
      }
      setParticipants(parts);
    } catch {}
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        const unreadIds = data.messages
          .filter((m: Message) => m.reads.length === 0 && m.senderType !== "arl")
          .map((m: Message) => m.id);
        if (unreadIds.length > 0) {
          await fetch("/api/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unreadIds }),
          });
          fetchConversations();
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [fetchConversations]);

  useEffect(() => {
    fetchConversations();
    fetchMemberInfo();
    const interval = setInterval(fetchConversations, 8000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchMemberInfo]);

  useEffect(() => {
    if (activeConvo) {
      fetchMessages(activeConvo.id);
      const interval = setInterval(() => fetchMessages(activeConvo.id), 4000);
      return () => clearInterval(interval);
    }
  }, [activeConvo, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvo || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvo.id, content: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage("");
        await fetchMessages(activeConvo.id);
        fetchConversations();
      }
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || newGroup.memberIds.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", name: newGroup.name.trim(), memberIds: newGroup.memberIds, memberTypes: newGroup.memberTypes }),
      });
      if (res.ok) {
        setShowNewGroup(false);
        setNewGroup({ name: "", memberIds: [], memberTypes: [] });
        await fetchConversations();
      }
    } catch {}
    setCreatingGroup(false);
  };

  const startDirectChat = async (p: Participant) => {
    setStartingDirect(true);
    try {
      const res = await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", memberIds: [p.id], memberTypes: [p.type] }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchConversations();
        const convId = data.conversation?.id;
        if (convId) {
          const res2 = await fetch("/api/messages");
          if (res2.ok) {
            const d = await res2.json();
            const found = (d.conversations || []).find((c: Conversation) => c.id === convId);
            if (found) {
              setShowNewDirect(false);
              setDirectSearch("");
              setActiveConvo(found);
            }
          }
        }
      }
    } catch {}
    setStartingDirect(false);
  };

  const toggleMember = (p: Participant) => {
    setNewGroup((prev) => {
      const idx = prev.memberIds.indexOf(p.id);
      if (idx >= 0) {
        return { ...prev, memberIds: prev.memberIds.filter((_, i) => i !== idx), memberTypes: prev.memberTypes.filter((_, i) => i !== idx) };
      }
      return { ...prev, memberIds: [...prev.memberIds, p.id], memberTypes: [...prev.memberTypes, p.type] };
    });
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  // Build read receipt detail for a message in a group/global convo
  const getReceiptDetail = (msg: Message, convo: Conversation) => {
    if (convo.type === "direct") return null;
    const readIds = new Set(msg.reads.map((r) => r.readerId));
    // Get all members except the sender
    const members = convo.members || [];
    const others = members.filter((m) => m.memberId !== msg.senderId);
    const readMembers = others.filter((m) => readIds.has(m.memberId));
    const unreadMembers = others.filter((m) => !readIds.has(m.memberId));
    return { readMembers, unreadMembers };
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
      </div>
    );
  }

  // New group modal
  if (showNewGroup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNewGroup(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-bold text-slate-800">New Group Chat</h3>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Group Name</label>
          <Input
            value={newGroup.name}
            onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Morning Managers"
            className="rounded-xl"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">Add Members ({newGroup.memberIds.length} selected)</label>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {participants.length === 0 && (
              <button onClick={fetchParticipants} className="w-full rounded-xl border border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:border-slate-300">
                Load participants
              </button>
            )}
            {participants.map((p) => {
              const selected = newGroup.memberIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleMember(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    selected ? "border-[var(--hub-red)]/30 bg-red-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    p.type === "location" ? "bg-slate-100 text-slate-600" : "bg-purple-100 text-purple-600"
                  )}>
                    {p.type === "location" ? <Store className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.type === "location" ? `Store #${p.storeNumber}` : "ARL"}</p>
                  </div>
                  {selected && <div className="h-4 w-4 rounded-full bg-[var(--hub-red)]" />}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          onClick={handleCreateGroup}
          disabled={!newGroup.name.trim() || newGroup.memberIds.length === 0 || creatingGroup}
          className="w-full rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
        >
          {creatingGroup ? "Creating..." : "Create Group"}
        </Button>
      </div>
    );
  }

  // New direct message picker
  if (showNewDirect) {
    const filtered = participants.filter((p) =>
      p.name.toLowerCase().includes(directSearch.toLowerCase()) ||
      (p.storeNumber && p.storeNumber.includes(directSearch))
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowNewDirect(false); setDirectSearch(""); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-bold text-slate-800">New Direct Message</h3>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
          <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={directSearch}
            onChange={(e) => setDirectSearch(e.target.value)}
            placeholder="Search locations & ARLs..."
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
          />
        </div>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {participants.length === 0 && (
            <button onClick={fetchParticipants} className="w-full rounded-xl border border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:border-slate-300">
              Load participants
            </button>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => startDirectChat(p)}
              disabled={startingDirect}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                p.type === "location" ? "bg-slate-100 text-slate-600" : "bg-purple-100 text-purple-600"
              )}>
                {p.type === "location" ? <Store className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{p.name}</p>
                <p className="text-[10px] text-slate-400">{p.type === "location" ? `Store #${p.storeNumber}` : "ARL"}</p>
              </div>
              {startingDirect && <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />}
            </button>
          ))}
          {filtered.length === 0 && participants.length > 0 && (
            <p className="py-6 text-center text-xs text-slate-400">No results</p>
          )}
        </div>
      </div>
    );
  }

  // Conversation list
  if (!activeConvo) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Messages</h3>
            <p className="text-xs text-slate-400">{totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowNewDirect(true); fetchParticipants(); }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Direct
            </button>
            <button
              onClick={() => { setShowNewGroup(true); fetchParticipants(); }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Group
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => setActiveConvo(convo)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md",
                convo.unreadCount > 0 ? "border-[var(--hub-red)]/20 bg-red-50/30" : "border-slate-200"
              )}
            >
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", convIconBg(convo.type))}>
                {convIcon(convo.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{convo.name}</span>
                  {convo.lastMessage && (
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(convo.lastMessage.createdAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">{convo.subtitle}</p>
                {convo.lastMessage && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    <span className="text-slate-400">{convo.lastMessage.senderName}: </span>
                    {convo.lastMessage.content}
                  </p>
                )}
              </div>
              {convo.unreadCount > 0 && (
                <Badge className="shrink-0 bg-[var(--hub-red)] text-white text-[10px] h-5 min-w-5 px-1 flex items-center justify-center rounded-full">
                  {convo.unreadCount}
                </Badge>
              )}
            </button>
          ))}

          {conversations.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200">
              <div className="text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No conversations yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat view
  const isGroup = activeConvo.type === "group" || activeConvo.type === "global";
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm" onClick={() => setReceiptPopover(null)}>
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <button onClick={() => setActiveConvo(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", convIconBg(activeConvo.type))}>
          {convIcon(activeConvo.type)}
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">{activeConvo.name}</h4>
          <p className="text-[10px] text-slate-400">{activeConvo.subtitle} · {activeConvo.memberCount} members</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-slate-400">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderType === "arl";
            const hasBeenRead = msg.reads.length > 0;
            const receiptDetail = isGroup && isMe ? getReceiptDetail(msg, activeConvo) : null;
            const showPopover = receiptPopover === msg.id;
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
              >
                {isGroup && !isMe && (
                  <span className="mb-0.5 ml-1 text-[10px] font-medium text-slate-400">{msg.senderName}</span>
                )}
                <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5",
                  isMe ? "rounded-br-md bg-[var(--hub-red)] text-white" : "rounded-bl-md bg-slate-100 text-slate-800"
                )}>
                  <p className="text-sm">{msg.content}</p>
                  <div className={cn("mt-1 flex items-center gap-1", isMe ? "justify-end" : "justify-start")}>
                    <span className={cn("text-[10px]", isMe ? "text-white/60" : "text-slate-400")}>
                      {format(new Date(msg.createdAt), "h:mm a")}
                    </span>
                    {isMe && (
                      <div className="relative">
                        {/* For groups: clickable to show read receipt popover. For direct: non-interactive. */}
                        {isGroup ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setReceiptPopover(showPopover ? null : msg.id); }}
                            className="flex items-center"
                            title="See who read this"
                          >
                            {hasBeenRead
                              ? <CheckCheck className="h-3 w-3 text-white cursor-pointer hover:text-white/70" />
                              : <Check className="h-3 w-3 text-white/50" />
                            }
                          </button>
                        ) : (
                          hasBeenRead
                            ? <CheckCheck className="h-3 w-3 text-white/80" />
                            : <Check className="h-3 w-3 text-white/50" />
                        )}
                        {/* Read receipt popover for group/global */}
                        {isGroup && showPopover && receiptDetail && (
                          <div
                            className="absolute bottom-full right-0 mb-2 z-50 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {receiptDetail.readMembers.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1">Read by</p>
                                {receiptDetail.readMembers.map((m) => {
                                  const info = memberInfoMap.get(m.memberId);
                                  return (
                                    <div key={m.memberId} className="flex items-center gap-1.5 py-0.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                      <span className="text-xs text-slate-700">{info?.name ?? m.memberId}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {receiptDetail.unreadMembers.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Not yet read</p>
                                {receiptDetail.unreadMembers.map((m) => {
                                  const info = memberInfoMap.get(m.memberId);
                                  return (
                                    <div key={m.memberId} className="flex items-center gap-1.5 py-0.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                      <span className="text-xs text-slate-400">{info?.name ?? m.memberId}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {receiptDetail.readMembers.length === 0 && receiptDetail.unreadMembers.length === 0 && (
                              <p className="text-xs text-slate-400">No other members</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={activeConvo.type === "global" ? "Send to everyone..." : "Type a message..."}
            className="flex-1 rounded-xl"
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon"
            className="h-10 w-10 shrink-0 rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
