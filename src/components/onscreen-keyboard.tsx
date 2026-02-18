"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Globe, Smile, ArrowUp, Space, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnscreenKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onInput: (value: string) => void;
  onDelete: () => void;
  onSubmit?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

type KeyboardMode = "lower" | "upper" | "numbers" | "emoji";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥"],
  },
  {
    name: "Gestures",
    emojis: ["👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✌️", "🤞", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪", "🦾", "🖕"],
  },
  {
    name: "Food",
    emojis: ["🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦀", "🦞", "🦐", "🦑", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰"],
  },
  {
    name: "Objects",
    emojis: ["⏰", "📱", "💻", "🖥️", "📷", "📹", "🎬", "📺", "📻", "🧭", "⏱️", "🔑", "🗝️", "🔒", "🔓", "📦", "📋", "📌", "📎", "🖊️", "✏️", "📝", "📁", "📂", "🗂️", "📅", "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊"],
  },
  {
    name: "Symbols",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "⭐", "🌟", "✨", "💫", "🔥", "💯", "✅", "❌", "⚠️", "🚫", "♻️", "💤", "🎉", "🎊", "🏆", "🥇"],
  },
];

const ROWS_LOWER = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["shift", "z", "x", "c", "v", "b", "n", "m", "delete"],
  ["123", "emoji", "space", ".", "return"],
];

const ROWS_UPPER = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["shift", "Z", "X", "C", "V", "B", "N", "M", "delete"],
  ["123", "emoji", "space", ".", "return"],
];

const ROWS_NUMBERS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
  ["#+=", ".", ",", "?", "!", "'", "delete"],
  ["ABC", "emoji", "space", ".", "return"],
];

export function OnscreenKeyboard({ isOpen, onClose, onInput, onDelete, onSubmit, inputRef }: OnscreenKeyboardProps) {
  const [mode, setMode] = useState<KeyboardMode>("lower");
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [capsLock, setCapsLock] = useState(false);

  const handleKey = useCallback((key: string) => {
    switch (key) {
      case "shift":
        if (mode === "lower") {
          setMode("upper");
        } else if (mode === "upper") {
          setCapsLock(!capsLock);
          if (capsLock) setMode("lower");
        }
        break;
      case "delete":
        onDelete();
        break;
      case "space":
        onInput(" ");
        if (mode === "upper" && !capsLock) setMode("lower");
        break;
      case "return":
        onSubmit?.();
        break;
      case "123":
      case "#+=":
        setMode("numbers");
        break;
      case "ABC":
        setMode("lower");
        break;
      case "emoji":
        setMode("emoji");
        break;
      default:
        onInput(key);
        if (mode === "upper" && !capsLock) setMode("lower");
        break;
    }
  }, [mode, capsLock, onInput, onDelete, onSubmit]);

  const rows = mode === "upper" ? ROWS_UPPER : mode === "numbers" ? ROWS_NUMBERS : ROWS_LOWER;

  const getKeyWidth = (key: string): string => {
    switch (key) {
      case "space": return "flex-[3]";
      case "shift":
      case "delete": return "flex-[1.5]";
      case "return": return "flex-[1.5]";
      case "123":
      case "ABC":
      case "#+=": return "flex-[1.2]";
      case "emoji": return "flex-[1]";
      default: return "flex-1";
    }
  };

  const getKeyContent = (key: string) => {
    switch (key) {
      case "shift":
        return <ArrowUp className={cn("h-4 w-4", mode === "upper" && "text-[var(--hub-red)]")} />;
      case "delete":
        return <Delete className="h-4 w-4" />;
      case "space":
        return <span className="text-xs text-slate-400">space</span>;
      case "return":
        return <CornerDownLeft className="h-4 w-4" />;
      case "emoji":
        return <Smile className="h-4 w-4" />;
      default:
        return <span className="text-sm font-medium">{key}</span>;
    }
  };

  const getKeyStyle = (key: string): string => {
    if (key === "shift" || key === "delete" || key === "123" || key === "ABC" || key === "#+=" || key === "emoji") {
      return "bg-slate-200 text-slate-600 hover:bg-slate-300 active:bg-slate-400";
    }
    if (key === "return") {
      return "bg-[var(--hub-red)] text-white hover:bg-[#c4001f] active:bg-[#a00020]";
    }
    return "bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 shadow-sm";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 300, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-slate-100/95 backdrop-blur-md"
        >
          {/* Close bar */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <div className="flex gap-1">
              {mode === "emoji" && EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.name}
                  onClick={() => setEmojiCategory(i)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors",
                    emojiCategory === i
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Emoji grid */}
          {mode === "emoji" ? (
            <div className="px-2 pb-2">
              <div className="grid grid-cols-10 gap-1 rounded-xl bg-white p-2">
                {EMOJI_CATEGORIES[emojiCategory].emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onInput(emoji)}
                    className="flex h-10 items-center justify-center rounded-lg text-xl transition-colors hover:bg-slate-100 active:bg-slate-200"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5 px-1">
                <button
                  onClick={() => setMode("lower")}
                  className="flex h-10 flex-[1.2] items-center justify-center rounded-xl bg-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-300"
                >
                  ABC
                </button>
                <button
                  onClick={() => onInput(" ")}
                  className="flex h-10 flex-[4] items-center justify-center rounded-xl bg-white text-xs text-slate-400 shadow-sm"
                >
                  space
                </button>
                <button
                  onClick={onDelete}
                  className="flex h-10 flex-[1.2] items-center justify-center rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300"
                >
                  <Delete className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Regular keyboard */
            <div className="space-y-1.5 px-2 pb-3">
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex justify-center gap-1.5">
                  {row.map((key) => (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleKey(key)}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-xl transition-colors",
                        getKeyWidth(key),
                        getKeyStyle(key)
                      )}
                    >
                      {getKeyContent(key)}
                    </motion.button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
