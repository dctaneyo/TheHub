"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { debounce } from "lodash";
import {
  Send,
  X,
  MessageCircle,
  CheckCheck,
  Check,
  ArrowLeft,
  Globe,
  Users,
  Store,
  Plus,
  Search,
  Maximize2,
  Minimize2,
  Keyboard,
  Trash2,
  Heart,
  ThumbsUp,
  Laugh,
  Smile,
} from "lucide-react";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSocket } from "@/lib/socket-context";

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
  reactions?: Array<{ emoji: string; userId: string; userName: string; createdAt: string }>;
}

interface Conversation {
  id: string;
  type: "direct" | "global" | "group";
  name: string;
  subtitle: string;
  lastMessage: { content: string; createdAt: string; senderName: string } | null;
  unreadCount: number;
  memberCount: number;
}

function convIcon(type: "direct" | "global" | "group") {
  if (type === "global") return <Globe className="h-4 w-4" />;
  if (type === "group") return <Users className="h-4 w-4" />;
  return <Store className="h-4 w-4" />;
}

function convIconBg(type: "direct" | "global" | "group") {
  if (type === "global") return "bg-blue-100 text-blue-600";
  if (type === "group") return "bg-purple-100 text-purple-600";
  return "bg-slate-100 text-slate-500";
}

interface Participant {
  id: string;
  name: string;
  type: "location" | "arl";
  storeNumber?: string;
}

interface RestaurantChatProps {
  isOpen: boolean;
  onClose: () => void;
  unreadCount: number;
  onUnreadChange: (count: number) => void;
}

export function RestaurantChat({ isOpen, onClose, unreadCount, onUnreadChange }: RestaurantChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  const [newChatMode, setNewChatMode] = useState<"direct" | "group">("direct");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<Participant[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevUnreadRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setActiveConvo(null);
      setShowNewChat(false);
    } else {
      // Always open in slideout view, never fullscreen
      setIsFullscreen(false);
    }
  }, [isOpen]);

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

  const toggleGroupMember = (p: Participant) => {
    setGroupMembers((prev) =>
      prev.find((m) => m.id === p.id) ? prev.filter((m) => m.id !== p.id) : [...prev, p]
    );
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    setStartingChat(true);
    try {
      const res = await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          name: groupName.trim(),
          memberIds: groupMembers.map((m) => m.id),
          memberTypes: groupMembers.map((m) => m.type),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowNewChat(false);
        setGroupName("");
        setGroupMembers([]);
        setParticipantSearch("");
        const res2 = await fetch("/api/messages");
        if (res2.ok) {
          const d = await res2.json();
          setConversations(d.conversations || []);
          const found = (d.conversations || []).find((c: Conversation) => c.id === data.conversation?.id);
          if (found) setActiveConvo(found);
        }
      }
    } catch {}
    setStartingChat(false);
  };

  const startDirectChat = async (p: Participant) => {
    setStartingChat(true);
    try {
      const res = await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", memberIds: [p.id], memberTypes: [p.type] }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchConversations();
        // Find and open the conversation
        const convId = data.conversation?.id;
        if (convId) {
          setShowNewChat(false);
          setParticipantSearch("");
          // Refresh then open
          const res2 = await fetch("/api/messages");
          if (res2.ok) {
            const d = await res2.json();
            const found = (d.conversations || []).find((c: Conversation) => c.id === convId);
            if (found) setActiveConvo(found);
          }
        }
      }
    } catch {}
    setStartingChat(false);
  };

  const playMessageChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      // Loud triple-tone alert for noisy kitchen environments
      [[880, 0, 0.18], [1100, 0.22, 0.18], [880, 0.44, 0.18], [1100, 0.66, 0.18], [1320, 0.88, 0.25]].forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.5, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + dur);
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
        let convs: Conversation[] = data.conversations || [];
        
        // Deduplicate conversations by ID (keep the one with the most recent message)
        const conversationMap = new Map<string, Conversation>();
        convs.forEach(convo => {
          const existing = conversationMap.get(convo.id);
          if (!existing) {
            conversationMap.set(convo.id, convo);
          } else {
            // Keep the conversation with the more recent last message
            const existingTime = existing.lastMessage?.createdAt || "";
            const newTime = convo.lastMessage?.createdAt || "";
            if (newTime > existingTime) {
              conversationMap.set(convo.id, convo);
            }
          }
        });
        
        const deduplicatedConvs = Array.from(conversationMap.values());
        
        // Debug: Check for duplicate conversation IDs
        const ids = deduplicatedConvs.map(c => c.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          console.warn("Duplicate conversation IDs detected:", ids);
          console.warn("Duplicates:", ids.filter((id, index) => ids.indexOf(id) !== index));
        }
        
        // Debug: Log conversation details
        console.log("Conversations fetched:", deduplicatedConvs.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          lastMessageTime: c.lastMessage?.createdAt,
          unreadCount: c.unreadCount
        })));
        
        const total = deduplicatedConvs.reduce((s, c) => s + c.unreadCount, 0);
        if (initializedRef.current && total > prevUnreadRef.current) {
          playMessageChime();
        }
        prevUnreadRef.current = total;
        initializedRef.current = true;
        setConversations(deduplicatedConvs);
        onUnreadChange(total);
      }
    } catch {}
  }, [onUnreadChange, playMessageChime]);

  // Add debouncing to prevent race conditions
  const debouncedFetchConversations = useCallback(
    debounce(() => {
      fetchConversations();
    }, 300), // 300ms debounce
    [fetchConversations]
  );

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      // Purge old messages (>2 weeks) silently
      fetch("/api/messages/purge", { method: "POST" }).catch(() => {});
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      if (res.ok) {
        const data = await res.json();
        // Track known IDs so only truly new messages animate
        for (const m of data.messages) knownMessageIdsRef.current.add(m.id);
        setMessages(data.messages);
        // Mark unread as read
        const unreadIds = data.messages
          .filter((m: Message) => m.reads.length === 0 && m.senderType !== "location")
          .map((m: Message) => m.id);
        if (unreadIds.length > 0) {
          await fetch("/api/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unreadIds }),
          });
          // Don't fetchConversations here - let the WebSocket handle it
        }
      }
    } catch {}
  }, [fetchConversations]);

  // WebSocket for instant updates
  const { socket, joinConversation, leaveConversation, startTyping, stopTyping } = useSocket();
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Socket listeners for conversations and messages
  useEffect(() => {
    if (!socket) return;
    const handleConvoUpdate = () => debouncedFetchConversations();
    const handleNewMessage = (data: { conversationId: string }) => {
      debouncedFetchConversations();
      if (activeConvo && data.conversationId === activeConvo.id) {
        fetchMessages(activeConvo.id);
      }
    };
    const handleMessageRead = () => debouncedFetchConversations();
    const handleTypingStart = (data: { conversationId: string; userId: string; userName: string }) => {
      if (activeConvo && data.conversationId === activeConvo.id) {
        setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
        // Auto-clear after 3s
        const existing = typingTimeouts.current.get(data.userId);
        if (existing) clearTimeout(existing);
        typingTimeouts.current.set(data.userId, setTimeout(() => {
          setTypingUsers((prev) => { const n = new Map(prev); n.delete(data.userId); return n; });
        }, 3000));
      }
    };
    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => { const n = new Map(prev); n.delete(data.userId); return n; });
    };

    socket.on("conversation:updated", handleConvoUpdate);
    socket.on("message:new", handleNewMessage);
    socket.on("message:read", handleMessageRead);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    return () => {
      socket.off("conversation:updated", handleConvoUpdate);
      socket.off("message:new", handleNewMessage);
      socket.off("message:read", handleMessageRead);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, debouncedFetchConversations, fetchMessages, activeConvo]);

  // Join/leave conversation rooms
  useEffect(() => {
    if (activeConvo) {
      knownMessageIdsRef.current.clear();
      setShowAllMessages(false);
      fetchMessages(activeConvo.id);
      joinConversation(activeConvo.id);
      setTypingUsers(new Map());
      return () => {
        leaveConversation(activeConvo.id);
      };
    }
  }, [activeConvo, fetchMessages, joinConversation, leaveConversation]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

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
        debouncedFetchConversations();
      }
    } catch {}
    setSending(false);
  };

  const deleteConversation = async (convId: string) => {
    try {
      const res = await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConvo?.id === convId) setActiveConvo(null);
      }
    } catch {}
  };

  const isGroup = activeConvo?.type === "group" || activeConvo?.type === "global";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
          style={{ width: isFullscreen ? "100%" : 360, left: isFullscreen ? 0 : "auto" }}
          className="fixed right-0 top-0 z-40 flex h-dvh flex-col overflow-hidden border-l border-slate-200 bg-white shadow-xl"
        >
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-2">
              {(activeConvo || showNewChat) ? (
                <button
                  onClick={() => { setActiveConvo(null); setShowNewChat(false); setParticipantSearch(""); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)]/10 text-[var(--hub-red)]">
                  <MessageCircle className="h-4 w-4" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {activeConvo ? activeConvo.name : showNewChat ? "New Chat" : "Messages"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {activeConvo ? activeConvo.subtitle : showNewChat ? "Select someone to message" : `${conversations.length} conversations`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!activeConvo && !showNewChat && (
                <button
                  onClick={() => { setShowNewChat(true); fetchParticipants(); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsFullscreen((f) => !f)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* New chat picker */}
          {!activeConvo && showNewChat && (
            <div className="flex flex-1 flex-col overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
              {/* Direct / Group tabs */}
              <div className="flex gap-1 border-b border-slate-100 px-3 py-2">
                <button
                  onClick={() => setNewChatMode("direct")}
                  className={cn("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                    newChatMode === "direct" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
                  )}
                >Direct</button>
                <button
                  onClick={() => setNewChatMode("group")}
                  className={cn("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                    newChatMode === "group" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
                  )}
                >Group</button>
              </div>

              {/* Group name input */}
              {newChatMode === "group" && (
                <div className="border-b border-slate-100 px-3 py-2">
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                  />
                  {groupMembers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {groupMembers.map((m) => (
                        <button key={m.id} onClick={() => toggleGroupMember(m)}
                          className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-red-100 hover:text-red-600"
                        >
                          {m.name} <X className="h-2.5 w-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="border-b border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <input
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Search locations & ARLs..."
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                    tabIndex={-1}
                    onMouseDown={(e) => { e.currentTarget.tabIndex = 0; e.currentTarget.focus(); }}
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0 h-full">
                <div className="space-y-1 p-3">
                  {participants.length === 0 && (
                    <div className="flex h-32 items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
                    </div>
                  )}
                  {participants
                    .filter((p) =>
                      p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
                      (p.storeNumber && p.storeNumber.includes(participantSearch))
                    )
                    .map((p) => {
                      const isSelected = groupMembers.some((m) => m.id === p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => newChatMode === "direct" ? startDirectChat(p) : toggleGroupMember(p)}
                          disabled={startingChat && newChatMode === "direct"}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors disabled:opacity-50",
                            isSelected && newChatMode === "group" ? "bg-red-50" : "hover:bg-slate-50"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            p.type === "location" ? "bg-slate-100 text-slate-500" : "bg-purple-100 text-purple-600"
                          )}>
                            {p.type === "location" ? <Store className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {p.type === "location" ? `Store #${p.storeNumber}` : "ARL"}
                            </p>
                          </div>
                          {newChatMode === "group" && isSelected && (
                            <div className="h-4 w-4 shrink-0 rounded-full bg-[var(--hub-red)]" />
                          )}
                        </button>
                      );
                    })
                  }
                </div>
              </ScrollArea>

              {/* Create group button */}
              {newChatMode === "group" && (
                <div className="border-t border-slate-100 p-3">
                  <Button
                    onClick={createGroupChat}
                    disabled={!groupName.trim() || groupMembers.length === 0 || startingChat}
                    className="w-full rounded-xl bg-[var(--hub-red)] text-sm hover:bg-[#c4001f]"
                  >
                    {startingChat ? "Creating..." : `Create Group (${groupMembers.length} members)`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Conversation list */}
          {!activeConvo && !showNewChat && (
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-3">
                {conversations.length === 0 && (
                  <div className="flex h-40 items-center justify-center">
                    <div className="text-center">
                      <MessageCircle className="mx-auto h-8 w-8 text-slate-200" />
                      <p className="mt-2 text-xs text-slate-400">No conversations yet</p>
                    </div>
                  </div>
                )}
                {[...conversations].sort((a, b) => {
    // Global chats always come first
    if (a.type === "global" && b.type !== "global") return -1;
    if (b.type === "global" && a.type !== "global") return 1;
    
    // For same type, sort by last message time (most recent first)
    const aTime = a.lastMessage?.createdAt || "";
    const bTime = b.lastMessage?.createdAt || "";
    
    // If both have no last message, they're equal
    if (!aTime && !bTime) return 0;
    if (!aTime) return 1; // b has message, comes first
    if (!bTime) return -1; // a has message, comes first
    
    return bTime.localeCompare(aTime);
  }).map((convo) => (
                  <div key={convo.id} className="group relative">
                    <button
                      onClick={() => setActiveConvo(convo)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
                        convo.unreadCount > 0 ? "bg-red-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", convIconBg(convo.type))}>
                        {convIcon(convo.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-semibold text-slate-800">{convo.name}</span>
                          {convo.unreadCount > 0 && (
                            <span className="ml-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--hub-red)] px-1 text-[9px] font-bold text-white">
                              {convo.unreadCount}
                            </span>
                          )}
                        </div>
                        {convo.lastMessage && (
                          <p className="truncate text-[11px] text-slate-400">
                            {convo.lastMessage.senderName}: {convo.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </button>
                    {convo.type !== "global" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}
                        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 group-hover:flex"
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Messages view */}
          {activeConvo && <ActiveConvoView
            messages={messages}
            showAllMessages={showAllMessages}
            setShowAllMessages={setShowAllMessages}
            isGroup={isGroup}
            messagesEndRef={messagesEndRef}
            showKeyboard={showKeyboard}
            setShowKeyboard={setShowKeyboard}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sending={sending}
            handleSend={handleSend}
            convoType={activeConvo.type}
            typingUsers={typingUsers}
            onTyping={() => startTyping(activeConvo.id)}
            onStopTyping={() => stopTyping(activeConvo.id)}
            knownMessageIds={knownMessageIdsRef.current}
          />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ActiveConvoViewProps {
  messages: Message[];
  showAllMessages: boolean;
  setShowAllMessages: (v: boolean) => void;
  isGroup: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  showKeyboard: boolean;
  setShowKeyboard: (fn: (k: boolean) => boolean) => void;
  newMessage: string;
  setNewMessage: (v: string) => void;
  sending: boolean;
  handleSend: () => void;
  convoType: string;
  typingUsers: Map<string, string>;
  onTyping: () => void;
  onStopTyping: () => void;
  knownMessageIds: Set<string>;
}

function ActiveConvoView({
  messages, showAllMessages, setShowAllMessages, isGroup,
  messagesEndRef, showKeyboard, setShowKeyboard,
  newMessage, setNewMessage, sending, handleSend, convoType,
  typingUsers, onTyping, onStopTyping, knownMessageIds,
}: ActiveConvoViewProps) {
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleInputChange = (value: string) => {
    setNewMessage(value);
    onTyping();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(onStopTyping, 2000);
  };
  const typingNames = Array.from(typingUsers.values());
  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
  const visibleMessages = showAllMessages
    ? messages
    : messages.filter((m) => {
        const d = new Date(m.createdAt).toDateString();
        return d === todayStr || d === yesterdayStr;
      });
  const hasPast = messages.some((m) => {
    const d = new Date(m.createdAt).toDateString();
    return d !== todayStr && d !== yesterdayStr;
  });

  return (
    <>
      <ScrollArea className="flex-1 min-h-0 p-4">
        <div className="space-y-3">
          {!showAllMessages && hasPast && (
            <div className="flex justify-center pb-1">
              <button
                onClick={() => setShowAllMessages(true)}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition-colors"
              >
                View Past Messages
              </button>
            </div>
          )}
          {visibleMessages.length === 0 && (
            <div className="flex h-40 items-center justify-center">
              <p className="text-xs text-slate-400">No messages yet</p>
            </div>
          )}
          {visibleMessages.map((msg) => {
            const isMe = msg.senderType === "location";
            const hasBeenRead = msg.reads.length > 0;
            return (
              <motion.div key={msg.id}
                initial={knownMessageIds.has(msg.id) ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
              >
                {isGroup && !isMe && (
                  <span className="mb-0.5 ml-1 text-[10px] font-medium text-slate-400">{msg.senderName}</span>
                )}
                <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2",
                  isMe ? "rounded-br-md bg-[var(--hub-red)] text-white" : "rounded-bl-md bg-slate-100 text-slate-800"
                )}>
                  <p className="text-sm">{msg.content}</p>
                  <div className={cn("mt-0.5 flex items-center gap-1", isMe ? "justify-end" : "justify-start")}>
                    <span className={cn("text-[10px]", isMe ? "text-white/60" : "text-slate-400")}>
                      {format(new Date(msg.createdAt), "h:mm a")}
                    </span>
                    {isMe && (hasBeenRead
                      ? <CheckCheck className="h-3 w-3 text-white/80" />
                      : <Check className="h-3 w-3 text-white/50" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        {typingNames.length > 0 && (
          <div className="px-2 pb-1">
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[11px] text-slate-400">
                {typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames.join(", ")} are typing...`}
              </span>
            </motion.div>
          </div>
        )}
      </ScrollArea>

      {showKeyboard && (
        <OnscreenKeyboard
          value={newMessage}
          onChange={setNewMessage}
          onSubmit={newMessage.trim() && !sending ? handleSend : undefined}
          onDismiss={() => setShowKeyboard((k) => !k)}
          placeholder={convoType === "global" ? "Send to everyone..." : "Type a message..."}
        />
      )}

      <div className="border-t border-slate-200">
        <div className="flex gap-2 p-3">
          <button
            onClick={() => setShowKeyboard((k) => !k)}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              showKeyboard
                ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
            title="Onscreen keyboard"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <Input
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { onStopTyping(); handleSend(); } }}
            placeholder={convoType === "global" ? "Send to everyone..." : "Type a message..."}
            className="flex-1 rounded-xl"
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon"
            className="h-10 w-10 shrink-0 rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
