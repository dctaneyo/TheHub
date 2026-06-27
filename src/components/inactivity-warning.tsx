"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "@/lib/icons";

/**
 * The visible half of the inactivity timer (see use-inactivity-redirect.ts)
 * — a countdown, not a silent redirect, with an obvious way to cancel it.
 * Tapping anywhere (including the backdrop) counts as activity and is
 * handled by the hook's own window-level listeners, so this component
 * doesn't need its own dismiss handler beyond existing.
 *
 * The countdown is shown as a draining bar (not a number) — shape/fill
 * communicates urgency faster than reading a digit, per DESIGN.md Section 11.
 * The bar is the sole countdown signal; the body copy doesn't repeat it
 * as a number to avoid the Section 17 redundancy violation.
 */
export function InactivityWarning({
  show,
  secondsLeft,
  totalSeconds = 10,
}: {
  show: boolean;
  secondsLeft: number;
  /** Must match WARNING_MS / 1000 in use-inactivity-redirect.ts. Default: 10. */
  totalSeconds?: number;
}) {
  const pct = Math.max(0, Math.min(1, secondsLeft / totalSeconds)) * 100;

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
            <div className="flex w-full max-w-sm flex-col items-center overflow-hidden rounded-3xl border border-border bg-card shadow-xl text-center">
              {/* Content */}
              <div className="flex flex-col items-center gap-3 px-6 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Still there?</h2>
                <p className="text-sm text-muted-foreground">
                  Returning to the dashboard due to inactivity. Tap anywhere to stay.
                </p>
              </div>

              {/* Countdown bar — full-bleed at the bottom of the card.
                  Drains left-to-right; 700ms CSS transition smooths the
                  ~1 s integer steps from the hook's 250 ms tick. */}
              <div className="w-full h-1 bg-muted">
                <div
                  className="h-full bg-[var(--hub-red)] transition-[width] duration-700 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
