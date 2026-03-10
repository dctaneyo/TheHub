"use client";

import { motion } from "framer-motion";
import { useMirror } from "@/lib/mirror-context";
import { Eye, Hand, X, Monitor, Wifi } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function MirrorToolbar() {
  const {
    isMirroring,
    targetLocationName,
    controlEnabled,
    targetDevice,
    endMirror,
    toggleControl,
  } = useMirror();

  if (!isMirroring) return null;

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      data-remote-view-overlay="true"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-3 rounded-2xl border border-indigo-300 dark:border-indigo-800 bg-card/95 backdrop-blur-xl shadow-2xl px-4 py-2"
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950">
          <Monitor className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-foreground">
              Mirroring: {targetLocationName || "Target"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {targetDevice && (
              <span>
                {targetDevice.isMobile ? "📱 Mobile" : "🖥️ Desktop"} • {targetDevice.width}×{targetDevice.height}
              </span>
            )}
            {!targetDevice && <span>Connecting...</span>}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-border" />

      {/* Control toggle */}
      <button
        onClick={toggleControl}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all",
          controlEnabled
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-800"
            : "bg-muted text-muted-foreground hover:bg-accent"
        )}
      >
        {controlEnabled ? <Hand className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {controlEnabled ? "Control On" : "View Only"}
      </button>

      {/* End session */}
      <button
        onClick={endMirror}
        className="flex items-center gap-1.5 rounded-xl bg-red-100 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        End
      </button>
    </motion.div>
  );
}
