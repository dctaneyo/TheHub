"use client";

import { useOfflineSync } from "@/hooks/use-offline-sync";
import { WifiOff, RefreshCw, CloudOff, Check } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  // Don't show anything when online with no pending actions
  if (isOnline && pendingCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-4 py-2 shadow-lg backdrop-blur-md text-xs font-medium",
          isOnline
            ? "bg-amber-500/90 text-white"
            : "bg-red-600/90 text-white"
        )}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            <span>Offline</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {pendingCount} queued
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Syncing {pendingCount} actions...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <CloudOff className="h-3.5 w-3.5" />
            <span>{pendingCount} pending</span>
            <button
              onClick={syncNow}
              className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] hover:bg-white/30 transition-colors"
            >
              Sync Now
            </button>
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" />
            <span>All synced</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
