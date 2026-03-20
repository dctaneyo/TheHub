"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";

interface RenameDialogProps {
  identity: string;
  currentName: string;
  onRename: (identity: string, nickname: string) => void;
  onClose: () => void;
}

export function RenameDialog({ identity, currentName, onRename, onClose }: RenameDialogProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim()) {
      onRename(identity, input.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-700"
      >
        <h3 className="text-white font-bold text-base mb-1">Rename Participant</h3>
        <p className="text-slate-400 text-xs mb-4">Set a nickname for this participant. Original name will be preserved.</p>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter nickname"
          className="mb-4 bg-slate-800 border-slate-700 text-white"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) handleSubmit();
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold transition-colors"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
