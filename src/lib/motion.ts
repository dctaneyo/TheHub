import type { Transition } from "framer-motion";

/**
 * Shared Framer Motion timing constants. Durations reflect the values already
 * dominant across the codebase (0.15s and 0.2s account for most one-off
 * transitions; 1.2s/1.5s are the existing shimmer/pulse loop speeds) — this
 * file exists so new components reuse them instead of picking a new number.
 */
export const MOTION = {
  fast: { duration: 0.15, ease: "easeOut" } satisfies Transition,
  normal: { duration: 0.2, ease: "easeOut" } satisfies Transition,
  slow: { duration: 0.5, ease: "easeInOut" } satisfies Transition,
  loop: {
    shimmer: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } satisfies Transition,
    pulse: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } satisfies Transition,
  },
} as const;
