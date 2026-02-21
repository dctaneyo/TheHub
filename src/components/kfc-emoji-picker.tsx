"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { KFC_EMOJIS } from "@/lib/kfc-emojis";

interface KFCEmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function KFCEmojiPicker({ onSelect, onClose }: KFCEmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<keyof typeof KFC_EMOJIS>("food");

  const tabs: Array<{ key: keyof typeof KFC_EMOJIS; label: string; icon: string }> = [
    { key: "food", label: "Food", icon: "🍗" },
    { key: "work", label: "Work", icon: "👨‍🍳" },
    { key: "celebration", label: "Celebrate", icon: "🎉" },
    { key: "reactions", label: "React", icon: "❤️" },
    { key: "animals", label: "Animals", icon: "🐔" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="absolute bottom-full left-0 mb-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-700">KFC Emojis</h3>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="grid grid-cols-6 gap-2">
          {KFC_EMOJIS[activeTab].map((item, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onSelect(item.emoji);
                onClose();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-2xl"
              title={item.name}
            >
              {item.emoji}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
