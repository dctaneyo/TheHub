"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Send,
  ArrowLeft,
  CheckCheck,
  Check,
  Store,
  MessageCircle,
  Users,
  Plus,
  Hash,
  Smile,
} from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiQuickReplies } from "@/components/emoji-quick-replies";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { Emoji } from "@/components/ui/emoji";
import { GroupInfoModal } from "@/components/arl/group-info-modal";
import { Info, BellOff, Bell, Search, XCircle } from "@/lib/icons";
import { VoiceRecorder, VoiceMessagePlayer } from "@/components/voice-recorder";
import { MentionInput, MessageContent } from "@/components/mention-input";
import { SwipeableConvoRow, convIcon, convIconBg } from "./swipeable-convo-row";
import { useMessaging } from "./use-messaging";
import { ConversationListSkeleton } from "@/components/ui/skeleton";

const reactions = ["❤️", "👍", "😂", "😊"];

export function Messaging() {
  const {
    user,
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
    searchInputRef, messagesEndRef, msgScrollRef,
    handleSend, handleCreateGroup, startDirectChat,
    toggleMember, deleteConversation, addReaction,
    toggleMute, fetchParticipants, fetchConversations,
    fetchMessages, getReceiptDetail,
    startTyping, stopTyping,
  } = useMessaging();

  const msgVirtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => msgScrollRef.current,
    estimateSize: () => 72,
    gap: 12,
    overscan: 8,
  });

  if (loading) {
    return <ConversationListSkeleton />;
  }

  // New group modal
  if (showNewGroup) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNewGroup(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-bold text-foreground">New Group Chat</h3>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Group Name</label>
          <Input
            value={newGroup.name}
            onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Morning Managers"
            className="rounded-xl"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Add Members ({newGroup.memberIds.length} selected)</label>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {participants.length === 0 && (
              <button onClick={fetchParticipants} className="w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-border/80">
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
                    selected ? "border-[var(--hub-red)]/30 bg-red-50" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    p.type === "location" ? "bg-muted text-muted-foreground" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  )}>
                    {p.type === "location" ? <Store className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.type === "location" ? `Store #${p.storeNumber}` : "ARL"}</p>
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
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowNewDirect(false); setDirectSearch(""); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-bold text-foreground">New Direct Message</h3>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
          <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={directSearch}
            onChange={(e) => setDirectSearch(e.target.value)}
            placeholder="Search locations & ARLs..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {participants.length === 0 && (
            <button onClick={fetchParticipants} className="w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-border/80">
              Load participants
            </button>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => startDirectChat(p)}
              disabled={startingDirect}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
            >
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                p.type === "location" ? "bg-muted text-muted-foreground" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
              )}>
                {p.type === "location" ? <Store className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.type === "location" ? `Store #${p.storeNumber}` : "ARL"}</p>
              </div>
              {startingDirect && <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[var(--hub-red)]" />}
            </button>
          ))}
          {filtered.length === 0 && participants.length > 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No results</p>
          )}
        </div>
      </div>
    );
  }

  // Conversation list
  if (!activeConvo) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Messages</h3>
            <p className="text-xs text-muted-foreground">{totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setShowNewDirect(true); fetchParticipants(); }}
              className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Direct</span>
              <span className="sm:hidden">DM</span>
            </button>
            <button
              onClick={() => { setShowNewGroup(true); fetchParticipants(); }}
              className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80"
            >
              <Plus className="h-3.5 w-3.5" />
              Group
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {[...conversations].sort((a, b) => a.type === "global" ? -1 : b.type === "global" ? 1 : 0).map((convo) => (
            <SwipeableConvoRow
              key={convo.id}
              convo={convo}
              onOpen={() => setActiveConvo(convo)}
              onDelete={() => convo.type !== "global" && deleteConversation(convo.id)}
            />
          ))}

          {conversations.length === 0 && (
            <div className="flex h-40 items-center justify-center">
              <div className="text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">No conversations yet</p>
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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" onClick={() => setReceiptPopover(null)}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => setActiveConvo(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", convIconBg(activeConvo.type))}>
          {convIcon(activeConvo.type)}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-foreground">{activeConvo.name}</h4>
          <p className="text-[10px] text-muted-foreground">{activeConvo.subtitle} · {activeConvo.memberCount} members</p>
        </div>
        {isGroup && (
          <button
            onClick={() => setShowGroupInfo(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            title="Group Info"
            aria-label="Group info"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            showSearch ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400" : "text-muted-foreground hover:bg-muted"
          )}
          title="Search messages"
          aria-label="Search messages"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={() => toggleMute(activeConvo.id)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            mutedConvos.has(activeConvo.id)
              ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
              : "text-muted-foreground hover:bg-muted"
          )}
          title={mutedConvos.has(activeConvo.id) ? "Unmute notifications" : "Mute notifications"}
          aria-label={mutedConvos.has(activeConvo.id) ? "Unmute notifications" : "Mute notifications"}
        >
          {mutedConvos.has(activeConvo.id) ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length} result(s)
            </p>
          )}
        </div>
      )}

      <div ref={msgScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4" onClick={() => setReceiptPopover(null)}>
        {!showAllMessages && hasPast && (
          <div className="flex justify-center pb-3">
            <button
              onClick={() => setShowAllMessages(true)}
              className="rounded-full bg-muted px-4 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/80"
            >
              View Past Messages
            </button>
          </div>
        )}
        {visibleMessages.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div style={{ height: msgVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {msgVirtualizer.getVirtualItems().map((vRow) => {
              const msg = visibleMessages[vRow.index];
              const isMe = msg.senderId === user?.id;
              const hasBeenRead = msg.reads.length > 0;
              const receiptDetail = isGroup && isMe ? getReceiptDetail(msg, activeConvo) : null;
              const showPopover = receiptPopover === msg.id;
              return (
                <div
                  key={msg.id}
                  data-index={vRow.index}
                  ref={msgVirtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
                >
                  <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    {isGroup && !isMe && (
                      <span className="mb-0.5 ml-1 text-[10px] font-medium text-muted-foreground">{msg.senderName}</span>
                    )}
                    <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5",
                      isMe ? "rounded-br-md bg-[var(--hub-red)] text-white" : "rounded-bl-md bg-muted text-foreground"
                    )}>
                      {msg.messageType === "voice" ? (() => {
                        try {
                          const meta = JSON.parse((msg as any).metadata || "{}");
                          return <VoiceMessagePlayer audioUrl={`/api/messages/voice/${msg.id}`} duration={meta.durationMs || 0} />;
                        } catch { return <MessageContent content={msg.content} />; }
                      })() : <MessageContent content={msg.content} />}

                      {/* Reactions display - inline */}
                      {msg.reactions && msg.reactions.length > 0 && (() => {
                        const grouped = msg.reactions.reduce((acc: Record<string, number>, r: { emoji: string }) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        return (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Object.entries(grouped).map(([emoji, count]) => (
                              <div key={emoji} className={cn(
                                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
                                isMe ? "bg-white/20" : "bg-card border border-border"
                              )}>
                                <Emoji emoji={emoji} size={14} />
                                {count > 1 && <span className={cn("text-[10px] font-medium", isMe ? "text-white/80" : "text-muted-foreground")}>{count}</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      <div className={cn("mt-1 flex items-center gap-1", isMe ? "justify-end" : "justify-start")}>
                        <span className={cn("text-[10px]", isMe ? "text-white/60" : "text-muted-foreground")}>
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </span>
                        {isMe && (
                          <div className="relative">
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
                            {isGroup && showPopover && receiptDetail && (
                              <div
                                className="absolute bottom-full right-0 mb-2 z-50 w-52 rounded-xl border border-border bg-card p-3 shadow-xl text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {receiptDetail.readMembers.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1">Read by</p>
                                    {receiptDetail.readMembers.map((rm) => {
                                      const info = memberInfoMap.get(rm.memberId);
                                      return (
                                        <div key={rm.memberId} className="flex items-center gap-1.5 py-0.5">
                                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                          <span className="text-xs text-foreground">{info?.name ?? rm.memberId}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {receiptDetail.unreadMembers.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Not yet read</p>
                                    {receiptDetail.unreadMembers.map((um) => {
                                      const info = memberInfoMap.get(um.memberId);
                                      return (
                                        <div key={um.memberId} className="flex items-center gap-1.5 py-0.5">
                                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">{info?.name ?? um.memberId}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {receiptDetail.readMembers.length === 0 && receiptDetail.unreadMembers.length === 0 && (
                                  <p className="text-xs text-muted-foreground">No other members</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Reaction button */}
                        <button
                          onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                          className={cn("ml-1 transition-opacity hover:opacity-70", isMe ? "text-white/60" : "text-muted-foreground")}
                          title="Add reaction"
                        >
                          <Smile className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Reaction picker */}
                    <AnimatePresence>
                      {showReactions === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 5 }}
                          className="mt-1 flex gap-1.5 rounded-full bg-card shadow-lg border border-border px-2.5 py-1.5"
                        >
                          {reactions.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => addReaction(msg.id, emoji)}
                              className="hover:scale-125 transition-transform"
                            >
                              <Emoji emoji={emoji} size={24} />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
        {(() => {
          const typingNames = Array.from(typingUsers.values());
          if (typingNames.length === 0) return null;
          return (
            <div className="px-2 pb-1">
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames.join(", ")} are typing...`}
                </span>
              </motion.div>
            </div>
          );
        })()}
      </div>

      <div className="border-t border-border">
        {/* Emoji Quick Replies */}
        <div className="px-3 pt-3">
          <EmojiQuickReplies onSelect={(text) => {
            handleSend(text);
          }} />
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 relative">
            <MentionInput
              value={newMessage}
              onChange={setNewMessage}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }}
              placeholder="Type a message..."
              mentionables={mentionables}
            />
            <VoiceRecorder
              onSend={async (audioBlob, durationMs) => {
                const formData = new FormData();
                formData.append("audio", audioBlob, "voice.webm");
                formData.append("conversationId", activeConvo.id);
                formData.append("duration", String(durationMs));
                try {
                  await fetch("/api/messages/voice", { method: "POST", body: formData });
                  fetchMessages(activeConvo.id);
                } catch {}
              }}
            />
            <Button onClick={() => handleSend()} disabled={!newMessage.trim() || sending} size="icon"
              className="h-10 w-10 shrink-0 rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Group Info Modal */}
      {activeConvo && isGroup && (
        <GroupInfoModal
          conversationId={activeConvo.id}
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          onUpdate={() => {
            fetchConversations();
            if (activeConvo) {
              fetchMessages(activeConvo.id);
            }
          }}
        />
      )}
    </div>
  );
}
