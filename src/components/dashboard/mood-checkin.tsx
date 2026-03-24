"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "@/lib/icons";
import { useAuth } from "@/lib/auth-context";
import { useReducedMotion, ANIMATION } from "@/lib/animation-constants";

const MOODS = [
  { score: 1, emoji: "😫", label: "Terrible" },
  { score: 2, emoji: "😕", label: "Bad" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "🤩", label: "Amazing" },
] as const;

const SESSION_KEY = "hub-mood-checked";
const DISMISS_COUNT_KEY = "hub-mood-dismiss-count";
const LOGIN_TIME_KEY = "hub-mood-login-time";

/** Delay before first appearance (ms) */
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 5 minutes
/** Delay before reappearing after first dismiss (ms) */
const REAPPEAR_DELAY_MS = 30 * 60 * 1000; // 30 minutes

export function MoodCheckinPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAppearance = useCallback((delayMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delayMs);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.userType !== "location") return;
    // Already completed mood check-in this session
    if (sessionStorage.getItem(SESSION_KEY)) return;
    // Already dismissed twice — suppressed for session
    const dismissCount = parseInt(sessionStorage.getItem(DISMISS_COUNT_KEY) || "0", 10);
    if (dismissCount >= 2) return;

    // Track login time for the 5-minute delay
    let loginTime = parseInt(sessionStorage.getItem(LOGIN_TIME_KEY) || "0", 10);
    if (!loginTime) {
      loginTime = Date.now();
      sessionStorage.setItem(LOGIN_TIME_KEY, String(loginTime));
    }

    const elapsed = Date.now() - loginTime;
    const remaining = Math.max(0, INITIAL_DELAY_MS - elapsed);

    // If we've already waited 5 min (e.g. navigated away and back), show immediately
    // unless we're in a reappear-after-dismiss scenario
    if (dismissCount === 0) {
      scheduleAppearance(remaining);
    }
    // If dismiss count is 1, the reappear timer is handled by handleDismiss

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, scheduleAppearance]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    const currentCount = parseInt(sessionStorage.getItem(DISMISS_COUNT_KEY) || "0", 10);
    const newCount = currentCount + 1;
    sessionStorage.setItem(DISMISS_COUNT_KEY, String(newCount));

    if (newCount === 1) {
      // First dismiss: reappear after 30 minutes
      scheduleAppearance(REAPPEAR_DELAY_MS);
    }
    // Second dismiss (newCount >= 2): suppress for remainder of session — do nothing
  }, [scheduleAppearance]);

  const handleSelect = async (score: number) => {
    if (selected !== null) return;
    setSelected(score);

    try {
      await fetch("/api/mood-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodScore: score }),
      });
    } catch {
      // Silently fail — mood is non-critical
    }

    sessionStorage.setItem(SESSION_KEY, "true");

    // Show thank-you, then slide down to dismiss
    setTimeout(() => {
      setShowThankYou(true);
      setTimeout(() => {
        setVisible(false);
      }, prefersReducedMotion ? 0 : 1200);
    }, prefersReducedMotion ? 0 : 500);
  };

  if (!visible) return null;

  const springTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mood-checkin-card"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={springTransition}
          className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:max-w-sm"
          role="complementary"
          aria-label="Mood check-in"
        >
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg px-6 py-5">
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-muted-foreground"
              aria-label="Dismiss mood check-in"
            >
              <X className="h-4 w-4" />
            </button>

            <AnimatePresence mode="wait">
              {showThankYou ? (
                <motion.div
                  key="thank-you"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
                  className="flex flex-col items-center py-4"
                >
                  <span className="text-3xl mb-2">🙏</span>
                  <p className="text-sm font-medium text-foreground">Thanks for sharing!</p>
                </motion.div>
              ) : (
                <motion.div
                  key="mood-select"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                >
                  <p className="text-sm font-semibold text-foreground mb-1">
                    How are you feeling?
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Quick mood check — tap an emoji
                  </p>

                  <div
                    className="flex items-center justify-between gap-1"
                    role="group"
                    aria-label="Mood selection"
                  >
                    {MOODS.map((mood, i) => (
                      <motion.button
                        key={mood.score}
                        initial={{
                          opacity: prefersReducedMotion ? 1 : 0,
                          y: prefersReducedMotion ? 0 : 12,
                        }}
                        animate={{
                          opacity:
                            selected !== null && selected !== mood.score ? 0.3 : 1,
                          y: 0,
                          scale: selected === mood.score ? 1.15 : 1,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                          delay:
                            selected !== null || prefersReducedMotion ? 0 : i * 0.06,
                        }}
                        onClick={() => handleSelect(mood.score)}
                        disabled={selected !== null}
                        aria-label={`Mood: ${mood.label}`}
                        className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-default"
                      >
                        <span className="text-[64px] leading-none">{mood.emoji}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {mood.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
