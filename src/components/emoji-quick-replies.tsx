"use client";

import { motion } from "framer-motion";

interface EmojiQuickRepliesProps {
  onSelect: (text: string) => void;
  className?: string;
}

const EMOJI_QUICK_REPLIES = [
  { emoji: "👍", text: "Great job!" },
  { emoji: "👏", text: "Well done!" },
  { emoji: "🔥", text: "On fire!" },
  { emoji: "💪", text: "Keep it up!" },
  { emoji: "⭐", text: "Excellent!" },
  { emoji: "✅", text: "Perfect!" },
  { emoji: "🎉", text: "Awesome!" },
  { emoji: "💯", text: "100%!" },
];

export function EmojiQuickReplies({ onSelect, className = "" }: EmojiQuickRepliesProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {EMOJI_QUICK_REPLIES.map((reply, index) => (
        <motion.button
          key={reply.text}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(`${reply.emoji} ${reply.text}`)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:from-orange-50 hover:to-red-50 hover:border-orange-200 hover:text-orange-700 transition-all shadow-sm hover:shadow"
        >
          <span className="text-sm">{reply.emoji}</span>
          <span>{reply.text}</span>
        </motion.button>
      ))}
    </div>
  );
}
