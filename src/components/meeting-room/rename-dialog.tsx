"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Rename Participant</DialogTitle>
          <DialogDescription className="text-slate-400">
            Set a nickname for this participant. Original name will be preserved.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter nickname"
          className="bg-slate-800 border-slate-700 text-white"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) handleSubmit();
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-600 text-white text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold transition-colors"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
