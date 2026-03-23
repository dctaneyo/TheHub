"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

const MOODS = [
  { score: 1, emoji: "😫", label: "Mood: Terrible" },
  { score: 2, emoji: "😕", label: "Mood: Bad" },
  { score: 3, emoji: "😐", label: "Mood: Okay" },
  { score: 4, emoji: "🙂", label: "Mood: Good" },
  { score: 5, emoji: "🤩", label: "Mood: Amazing" },
] as const;

const SESSION_KEY = "hub-mood-checked";

export function MoodCheckinPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.userType !== "location") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setVisible(true);
  }, [user]);

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

    // Dismiss after selection animation
    setTimeout(() => {
      setDismissing(true);
      setTimeout(() => setVisible(false), 400);
    }, 600);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {!dismissing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/40 shadow-2xl px-8 py-6 mx-4 max-w-md w-full"
          >
            <p className="text-center text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
              How are you feeling?
            </p>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
              Quick mood check — tap an emoji
            </p>

            <div className="flex items-center justify-center gap-3" role="group" aria-label="Mood selection">
              {MOODS.map((mood, i) => (
                <motion.button
                  key={mood.score}
                  initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 20, scale: prefersReducedMotion ? 1 : 0.5 }}
                  animate={{
                    opacity: selected !== null && selected !== mood.score ? 0.3 : 1,
                    y: 0,
                    scale: selected === mood.score ? 1.3 : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 20,
                    delay: selected !== null || prefersReducedMotion ? 0 : i * 0.08,
                  }}
                  onClick={() => handleSelect(mood.score)}
                  disabled={selected !== null}
                  aria-label={mood.label}
                  className="w-[80px] h-[80px] flex items-center justify-center rounded-2xl text-4xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-default"
                >
                  {mood.emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
