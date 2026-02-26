"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export interface Mentionable {
  id: string;
  name: string;
  type: "location" | "arl";
  storeNumber?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  mentionables: Mentionable[];
  disabled?: boolean;
}

/** Detect an active @mention query in the input at the cursor position */
function getActiveMention(value: string, cursorPos: number): { query: string; start: number } | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/@(\w*)$/);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: before.length - match[0].length };
}

export function MentionInput({ value, onChange, onKeyDown, placeholder, className, mentionables, disabled }: MentionInputProps) {
  const [mentionQuery, setMentionQuery] = useState<{ query: string; start: number } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = mentionQuery
    ? mentionables.filter((m) => m.name.toLowerCase().includes(mentionQuery.query))
    : [];

  const insertMention = useCallback((m: Mentionable) => {
    if (!mentionQuery || !inputRef.current) return;
    const cursor = inputRef.current.selectionStart ?? value.length;
    const before = value.slice(0, mentionQuery.start);
    const after = value.slice(cursor);
    const newVal = `${before}@${m.name} ${after}`;
    onChange(newVal);
    setMentionQuery(null);
    // Move cursor after inserted mention
    setTimeout(() => {
      const pos = mentionQuery.start + m.name.length + 2; // @name + space
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    }, 0);
  }, [mentionQuery, value, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    const cursor = e.target.selectionStart ?? val.length;
    const mention = getActiveMention(val, cursor);
    setMentionQuery(mention);
    setSelectedIdx(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  // Close picker on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />

      <AnimatePresence>
        {mentionQuery && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-0 mb-1.5 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mention someone</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((m, i) => (
                <button
                  key={m.id}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    i === selectedIdx ? "bg-[var(--hub-red)]/10" : "hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    m.type === "location" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                  )}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">@{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.type === "location" ? `Store #${m.storeNumber}` : "ARL"}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Render message content with @mentions highlighted */
export function MessageContent({ content, className }: { content: string; className?: string }) {
  const parts = content.split(/(@\w+(?:\s\w+)*)/g);
  return (
    <p className={cn("text-sm", className)}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <span key={i} className="font-semibold text-amber-300 dark:text-amber-300">
              {part}
            </span>
          );
        }
        return part;
      })}
    </p>
  );
}
