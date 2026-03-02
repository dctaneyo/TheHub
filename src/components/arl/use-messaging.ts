"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import type { Conversation, Message, MemberInfo, Participant, NewGroupState } from "./messaging-types";
import type { Mentionable } from "@/components/mention-input";

export function useMessaging() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newGroup, setNewGroup] = useState<NewGroupState>({ name: "", memberIds: [], memberTypes: [] });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [memberInfoMap, setMemberInfoMap] = useState<Map<string, MemberInfo>>(new Map());
  const [receiptPopover, setReceiptPopover] = useState<string | null>(null);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [directSearch, setDirectSearch] = useState("");
  const [startingDirect, setStartingDirect] = useState(false);
  const [mentionables, setMentionables] = useState<Mentionable[]>([]);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [mutedConvos, setMutedConvos] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgScrollRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevUnreadRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const prevConvsRef = useRef<Conversation[]>([]);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const { socket, joinConversation, leaveConversation, startTyping, stopTyping } = useSocket();

  // ── Audio ──
  const playMessageChime = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime;
      ([[660, 0, 0.12], [880, 0.15, 0.18]] as [number, number, number][]).forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur);
      });
    } catch {}
  }, []);

  // ── Mute ──
  const toggleMute = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch("/api/messages/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.ok) {
        const { isMuted } = await res.json();
        setMutedConvos((prev) => {
          const next = new Set(prev);
          if (isMuted) next.add(conversationId);
          else next.delete(conversationId);
          return next;
        });
      }
    } catch {}
  }, []);

  // ── Data fetching ──
  const fetchMentionables = useCallback(async () => {
    try {
      const [locRes, arlRes] = await Promise.all([fetch("/api/locations"), fetch("/api/arls")]);
      const items: Mentionable[] = [];
      if (locRes.ok) { const d = await locRes.json(); for (const l of d.locations || []) items.push({ id: l.id, name: l.name, type: "location", storeNumber: l.storeNumber }); }
      if (arlRes.ok) { const d = await arlRes.json(); for (const a of d.data?.arls || []) items.push({ id: a.id, name: a.name, type: "arl", storeNumber: a.storeNumber }); }
      setMentionables(items);
    } catch {}
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const convs: Conversation[] = data.conversations;
        const newTotal = convs.reduce((s, c) => s + c.unreadCount, 0);
        if (initializedRef.current && newTotal > prevUnreadRef.current) {
          const prevConvs = prevConvsRef.current;
          const hasUnmutedIncrease = convs.some((c) => {
            const prev = prevConvs.find((p) => p.id === c.id);
            return !mutedConvos.has(c.id) && c.unreadCount > (prev?.unreadCount ?? 0);
          });
          if (hasUnmutedIncrease) playMessageChime();
        }
        prevConvsRef.current = convs;
        prevUnreadRef.current = newTotal;
        initializedRef.current = true;
        setConversations(convs);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [playMessageChime, mutedConvos]);

  const fetchMemberInfo = useCallback(async () => {
    try {
      const [locRes, arlRes] = await Promise.all([fetch("/api/locations"), fetch("/api/arls")]);
      const map = new Map<string, MemberInfo>();
      if (locRes.ok) { const d = await locRes.json(); for (const l of d.locations || []) map.set(l.id, { id: l.id, name: l.name, type: "location" }); }
      if (arlRes.ok) { const d = await arlRes.json(); for (const a of d.data?.arls || []) map.set(a.id, { id: a.id, name: a.name, type: "arl" }); }
      setMemberInfoMap(map);
    } catch {}
  }, []);

  const fetchParticipants = useCallback(async () => {
    try {
      const [locRes, arlRes] = await Promise.all([fetch("/api/locations"), fetch("/api/arls")]);
      const parts: Participant[] = [];
      if (locRes.ok) { const d = await locRes.json(); for (const l of d.locations || []) parts.push({ id: l.id, name: l.name, type: "location", storeNumber: l.storeNumber }); }
      if (arlRes.ok) { const d = await arlRes.json(); for (const a of d.data?.arls || []) parts.push({ id: a.id, name: a.name, type: "arl" }); }
      setParticipants(parts);
    } catch {}
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      fetch("/api/messages/purge", { method: "POST" }).catch(() => {});
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      if (res.ok) {
        const data = await res.json();
        for (const m of data.messages) knownMessageIdsRef.current.add(m.id);
        setMessages(data.messages);
        const unreadIds = data.messages
          .filter((m: Message) => m.reads.length === 0 && m.senderId !== user?.id)
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
  }, [fetchConversations, user?.id]);

  // ── Initial fetch ──
  useEffect(() => {
    fetchConversations();
    fetchParticipants();
    fetchMentionables();
    fetchMemberInfo();
  }, [fetchConversations, fetchParticipants, fetchMentionables, fetchMemberInfo]);

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;
    const handleConvoUpdate = (data?: { conversationId: string }) => {
      fetchConversations();
      if (activeConvo && data?.conversationId === activeConvo.id) {
        fetchMessages(activeConvo.id);
      }
    };
    const handleNewMessage = (data: { conversationId: string }) => {
      fetchConversations();
      if (activeConvo && data.conversationId === activeConvo.id) {
        fetchMessages(activeConvo.id);
      }
    };
    const handleMessageRead = () => fetchConversations();
    const handleTypingStart = (data: { conversationId: string; userId: string; userName: string }) => {
      if (activeConvo && data.conversationId === activeConvo.id) {
        setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
        const existing = typingTimeoutsRef.current.get(data.userId);
        if (existing) clearTimeout(existing);
        typingTimeoutsRef.current.set(data.userId, setTimeout(() => {
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
  }, [socket, fetchConversations, fetchMessages, activeConvo]);

  // ── Join/leave conversation rooms ──
  useEffect(() => {
    if (activeConvo) {
      knownMessageIdsRef.current.clear();
      setShowAllMessages(false);
      fetchMessages(activeConvo.id);
      joinConversation(activeConvo.id);
      setTypingUsers(new Map());
      return () => { leaveConversation(activeConvo.id); };
    }
  }, [activeConvo, fetchMessages, joinConversation, leaveConversation]);

  // ── Computed values ──
  const { visibleMessages, hasPast } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const searchFiltered = searchQuery
      ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      : null;
    const visible = searchFiltered ?? (showAllMessages
      ? messages
      : messages.filter((m) => new Date(m.createdAt).getTime() >= yesterdayStart));
    const past = !searchFiltered && messages.some((m) => new Date(m.createdAt).getTime() < yesterdayStart);
    return { visibleMessages: visible, hasPast: past };
  }, [messages, searchQuery, showAllMessages]);

  // ── Scroll on new messages ──
  useEffect(() => {
    requestAnimationFrame(() => {
      if (msgScrollRef.current) {
        msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight;
      }
    });
  }, [messages]);

  // ── Actions ──
  const handleSend = async (directContent?: string) => {
    const content = (directContent || newMessage).trim();
    if (!content || !activeConvo || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvo.id, content }),
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

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await fetch("/api/messages/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      if (res.ok) {
        setShowReactions(null);
        if (activeConvo) fetchMessages(activeConvo.id);
      }
    } catch {}
  };

  const getReceiptDetail = (msg: Message, convo: Conversation) => {
    if (convo.type === "direct") return null;
    const readIds = new Set(msg.reads.map((r) => r.readerId));
    const members = convo.members || [];
    const others = members.filter((m) => m.memberId !== msg.senderId);
    const readMembers = others.filter((m) => readIds.has(m.memberId));
    const unreadMembers = others.filter((m) => !readIds.has(m.memberId));
    return { readMembers, unreadMembers };
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return {
    // Auth
    user,
    // State
    conversations, activeConvo, setActiveConvo,
    messages, visibleMessages, hasPast,
    showAllMessages, setShowAllMessages,
    newMessage, setNewMessage,
    loading, sending,
    showNewGroup, setShowNewGroup,
    participants, newGroup, setNewGroup, creatingGroup,
    memberInfoMap, receiptPopover, setReceiptPopover,
    showNewDirect, setShowNewDirect,
    directSearch, setDirectSearch, startingDirect,
    mentionables, showReactions, setShowReactions,
    showGroupInfo, setShowGroupInfo,
    mutedConvos, showSearch, setShowSearch,
    searchQuery, setSearchQuery,
    typingUsers, totalUnread,
    // Refs
    searchInputRef, messagesEndRef, msgScrollRef,
    // Actions
    handleSend, handleCreateGroup, startDirectChat,
    toggleMember, deleteConversation, addReaction,
    toggleMute, fetchParticipants, fetchConversations,
    fetchMessages, getReceiptDetail,
    // Socket
    startTyping, stopTyping,
  };
}
