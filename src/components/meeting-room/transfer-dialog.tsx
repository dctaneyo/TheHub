"use client";

import { motion } from "framer-motion";
import { ArrowRightLeft } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Participant, LocalParticipant } from "livekit-client";

interface TransferDialogProps {
  participants: Participant[];
  localParticipant: LocalParticipant;
  onTransfer: (targetIdentity: string, targetName?: string) => void;
  onClose: () => void;
}

export function TransferDialog({ participants, localParticipant, onTransfer, onClose }: TransferDialogProps) {
  const others = participants.filter(p => p !== localParticipant);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-1">Transfer Host Role</h3>
        <p className="text-slate-400 text-xs mb-4">Select a participant to become the new host. You will become a co-host.</p>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {others.map(p => {
            const metadata = p.metadata ? JSON.parse(p.metadata) : {};
            return (
              <button
                key={p.identity}
                onClick={() => onTransfer(p.identity, p.name)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                  metadata.userType === "arl" ? "bg-blue-600" : metadata.userType === "guest" ? "bg-purple-600" : "bg-slate-600"
                )}>
                  {p.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate block">{p.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{metadata.userType || "participant"}</span>
                </div>
                <ArrowRightLeft className="h-4 w-4 text-slate-500" />
              </button>
            );
          })}
          {others.length === 0 && (
            <p className="text-slate-500 text-xs text-center py-4">No other participants to transfer to</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}
