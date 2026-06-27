"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "@/lib/icons";

/**
 * The visible half of the inactivity timer (see use-inactivity-redirect.ts)
 * — a countdown, not a silent redirect, with an obvious way to cancel it.
 * Tapping anywhere (including the backdrop) counts as activity and is
 * handled by the hook's own window-level listeners, so this component
 * doesn't need its own dismiss handler beyond existing.
 */
export function InactivityWarning({
  show,
  secondsLeft,
}: {
  show: boolean;
  secondsLeft: number;
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[401] flex items-center justify-center p-4"
          >
            <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Still there?</h2>
              <p className="text-sm text-muted-foreground">
                Returning to the dashboard in {secondsLeft}s due to inactivity. Tap anywhere to stay.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
