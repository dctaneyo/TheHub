"use client";

import { useState, useEffect } from "react";

// ── Animation Timing Constants ──────────────────────────────────
// Matches the Animation Specification appendix in design.md

export const ANIMATION = {
  /** Page transition: opacity cross-fade */
  pageTransition: { duration: 0.2, ease: "ease" as const },

  /** Card press: scale(0.98) → scale(1) */
  cardPress: { duration: 0.15, scale: 0.98 },

  /** List item stagger: per-item delay */
  listStagger: { delayPerItem: 0.03, ease: "easeOut" as const },

  /** Task completion: checkmark spring */
  taskCompletion: { duration: 0.4, type: "spring" as const, stiffness: 300, damping: 20 },

  /** Points fly to XP bar */
  pointsFlyUp: { duration: 0.6, ease: "easeOut" as const },

  /** XP bar fill */
  xpBarFill: { type: "spring" as const, stiffness: 100, damping: 20 },

  /** Badge unlock: radial burst */
  badgeUnlock: { duration: 2, type: "spring" as const },

  /** Hub Menu slide-down */
  hubMenuSlide: { duration: 0.2, ease: "easeOut" as const },

  /** Bottom sheet */
  bottomSheet: { type: "spring" as const, stiffness: 300, damping: 30 },

  /** Background hue shift */
  backgroundHue: { duration: 3, ease: "ease" as const },

  /** Overdue stripe pulse: infinite loop */
  overdueStripePulse: { duration: 2, ease: "easeInOut" as const },

  /** Confetti burst */
  confettiBurst: { duration: 1.5, ease: "easeOut" as const },

  /** Shift handoff card swipe */
  shiftHandoffSwipe: { type: "spring" as const, stiffness: 300, damping: 30 },
} as const;

// ── Reduced Motion Hook ─────────────────────────────────────────
// Requirement 14.1: When prefers-reduced-motion is enabled, all
// animation durations become 0ms and transforms are disabled.

/**
 * Returns `true` when the user has enabled `prefers-reduced-motion: reduce`.
 * Components should use this to set duration to 0 and skip transforms.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

// ── Reduced-Motion-Aware Transition Helpers ─────────────────────

/** Returns a Framer Motion transition with duration 0 when reduced motion is on. */
export function getTransition(
  reduced: boolean,
  transition: Record<string, unknown>,
): Record<string, unknown> {
  if (reduced) {
    return { duration: 0 };
  }
  return transition;
}

/** Returns a spring transition or instant when reduced motion is on. */
export function getSpringTransition(
  reduced: boolean,
  opts: { stiffness?: number; damping?: number; duration?: number } = {},
): Record<string, unknown> {
  if (reduced) {
    return { duration: 0 };
  }
  return {
    type: "spring",
    stiffness: opts.stiffness ?? 300,
    damping: opts.damping ?? 30,
    ...(opts.duration !== undefined ? { duration: opts.duration } : {}),
  };
}

// ── Touch Target Constants ──────────────────────────────────────
// Requirement 14.3, 14.4, 14.5

export const TOUCH_TARGETS = {
  /** Minimum icon touch target (Header, Bottom_Nav) */
  icon: 40,
  /** Minimum primary action touch target (Shift_Handoff "Got It") */
  primaryAction: 64,
} as const;
