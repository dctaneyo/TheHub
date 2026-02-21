"use client";

import { motion } from "framer-motion";
import { EMOJI_QUICK_REPLIES } from "@/lib/kfc-emojis";

interface EmojiQuickRepliesProps {
  onSelect: (text: string) => void;
  className?: string;
}

export function EmojiQuickReplies({ onSelect, className = "" }: EmojiQuickRepliesProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {EMOJI_QUICK_REPLIES.map((reply, index) => (
        <motion.button
          key={reply.text}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(reply.text)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:from-orange-50 hover:to-red-50 hover:border-orange-200 hover:text-orange-700 transition-all shadow-sm hover:shadow"
        >
          <span className="text-sm">{reply.emoji}</span>
          <span>{reply.text}</span>
        </motion.button>
      ))}
    </div>
  );
}
