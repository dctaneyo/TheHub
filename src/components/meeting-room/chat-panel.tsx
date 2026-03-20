"use client";

import { useRef } from "react";
import { X, Send, Keyboard } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import type { ChatMessage } from "./types";

interface ChatPanelProps {
  messages: ChatMessage[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  isArlUser: boolean;
  showKeyboard: boolean;
  onToggleKeyboard: () => void;
}

export function ChatPanel({
  messages,
  newMessage,
  onNewMessageChange,
  onSend,
  onClose,
  isArlUser,
  showKeyboard,
  onToggleKeyboard,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">Chat</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8">No messages yet</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-semibold text-slate-300">{msg.senderName}</span>
                {msg.senderType === "arl" && <span className="text-[9px] font-bold bg-red-600/30 text-red-400 px-1 py-0.5 rounded">ARL</span>}
              </div>
              <div className="text-sm text-slate-200 bg-slate-700/50 rounded-lg p-2">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      {!isArlUser && showKeyboard && (
        <OnscreenKeyboard
          value={newMessage}
          onChange={onNewMessageChange}
          onSubmit={newMessage.trim() ? onSend : undefined}
          onDismiss={onToggleKeyboard}
          placeholder="Type a message..."
        />
      )}
      <div className="p-3 border-t border-slate-700 flex gap-2">
        {!isArlUser && (
          <button
            onClick={onToggleKeyboard}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              showKeyboard ? "bg-red-600/20 text-red-400" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            )}
            title="Onscreen keyboard"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        )}
        <Input
          value={newMessage}
          onChange={e => onNewMessageChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Type a message..."
          className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm"
        />
        <Button onClick={onSend} disabled={!newMessage.trim()} size="icon" className="bg-red-600 hover:bg-red-700 h-9 w-9 shrink-0" aria-label="Send chat message">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
