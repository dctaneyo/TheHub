"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SmartSummary } from "./smart-summary";

// ── Types ──

interface ShiftHandoffData {
  completedTaskCount: number;
  remainingTaskCount: number;
  remainingTasks: { id: string; title: string; dueTime: string }[];
  arlMessages: { senderName: string; content: string; sentAt: string }[];
  moodScoreAvg: number | null;
  shiftPeriod: "morning" | "afternoon" | "evening";
}

interface ShiftHandoffOverlayProps {
  data: ShiftHandoffData;
  onDismiss: () => void;
  showSmartSummary?: boolean;
}

// ── Helpers ──

export function getShiftPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const PHASE_GRADIENTS: Record<string, string> = {
  morning: "from-amber-200 via-orange-100 to-yellow-50",
  afternoon: "from-orange-300 via-amber-200 to-rose-100",
  evening: "from-indigo-500 via-purple-400 to-blue-300",
};

const MOOD_EMOJIS: Record<number, string> = {
  1: "😫",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "🤩",
};

function getMoodEmoji(score: number | null): string {
  if (score === null) return "—";
  const rounded = Math.round(score);
  return MOOD_EMOJIS[Math.max(1, Math.min(5, rounded))] ?? "😐";
}

// ── Animation Phases ──
// 0-3s: fade in + title
// 3-10s: counters
// 10-18s: remaining tasks
// 18-24s: ARL messages
// 24-28s: mood
// 28-30s: confirmation

type AnimPhase = "title" | "counters" | "tasks" | "messages" | "mood" | "confirmation";

function getPhase(elapsed: number): AnimPhase {
  if (elapsed < 3) return "title";
  if (elapsed < 10) return "counters";
  if (elapsed < 18) return "tasks";
  if (elapsed < 24) return "messages";
  if (elapsed < 28) return "mood";
  return "confirmation";
}

// ── Animated Counter ──

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let raf: number;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span>{value}</span>;
}

// ── Main Overlay ──

export function ShiftHandoffOverlay({ data, onDismiss, showSmartSummary = true }: ShiftHandoffOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const phase = getPhase(elapsed);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Timer: tick every 100ms, auto-dismiss at 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= 30) {
          clearInterval(interval);
          onDismiss();
          return 30;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onDismiss]);

  const gradient = PHASE_GRADIENTS[data.shiftPeriod] ?? PHASE_GRADIENTS.morning;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} text-foreground`}
    >
      {/* Got It button - always visible */}
      <button
        onClick={onDismiss}
        aria-label="Got it, dismiss shift handoff"
        className="absolute top-6 right-6 min-h-[64px] min-w-[64px] px-5 py-2.5 rounded-full bg-white/80 dark:bg-slate-800/80 text-sm font-bold shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-colors backdrop-blur-sm z-50"
      >
        Got It
      </button>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-black/10">
        <motion.div
          className="h-full bg-white/60"
          style={{ width: `${(elapsed / 30) * 100}%` }}
        />
      </div>

      <div className="w-full max-w-lg px-6 space-y-8 text-center">
        {/* Phase: Title (0-3s) */}
        <AnimatePresence mode="wait">
          {phase === "title" && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
              className="space-y-2"
            >
              <h1 className="text-4xl font-black text-slate-900 dark:text-white">
                Shift Complete
              </h1>
              <p className="text-lg text-slate-700 dark:text-slate-200 capitalize">
                {data.shiftPeriod} shift summary
              </p>
            </motion.div>
          )}

          {/* Phase: Counters (3-10s) */}
          {phase === "counters" && (
            <motion.div
              key="counters"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Shift Numbers</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-5 shadow-sm">
                  <p className="text-4xl font-black text-emerald-600">
                    <AnimatedCounter target={data.completedTaskCount} />
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Tasks Completed</p>
                </div>
                <div className="rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-5 shadow-sm">
                  <p className="text-4xl font-black text-amber-600">
                    <AnimatedCounter target={data.remainingTaskCount} />
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Tasks Remaining</p>
                </div>
              </div>
              {showSmartSummary && (
                <div className="mt-4">
                  <SmartSummary shiftPeriod={data.shiftPeriod} />
                </div>
              )}
            </motion.div>
          )}

          {/* Phase: Remaining Tasks (10-18s) */}
          {phase === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Remaining Tasks</h2>
              {data.remainingTasks.length === 0 ? (
                <p className="text-lg text-emerald-700 dark:text-emerald-300 font-semibold">
                  All tasks completed! 🎉
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {data.remainingTasks.slice(0, 8).map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ delay: i * 0.15, repeat: Infinity, duration: 2 }}
                      className="flex items-center justify-between rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-4 py-2.5 text-left"
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                        {task.title}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 shrink-0">
                        {task.dueTime}
                      </span>
                    </motion.div>
                  ))}
                  {data.remainingTasks.length > 8 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      +{data.remainingTasks.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Phase: ARL Messages (18-24s) */}
          {phase === "messages" && (
            <motion.div
              key="messages"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">ARL Messages</h2>
              {data.arlMessages.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-300">No messages this shift</p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {data.arlMessages.slice(0, 5).map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.2 }}
                      className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm px-4 py-3 text-left shadow-sm"
                    >
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                        {msg.senderName}
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200">{msg.content}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Phase: Mood (24-28s) */}
          {phase === "mood" && (
            <motion.div
              key="mood"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="space-y-3"
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Shift Mood</h2>
              <p className="text-7xl">
                {getMoodEmoji(data.moodScoreAvg)}
              </p>
              {data.moodScoreAvg !== null && (
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Average: {data.moodScoreAvg.toFixed(1)} / 5
                </p>
              )}
            </motion.div>
          )}

          {/* Phase: Confirmation (28-30s) */}
          {phase === "confirmation" && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: [1, 1.05, 1] }}
              transition={{ duration: 0.6, times: [0, 0.5, 1] }}
              className="space-y-3"
            >
              <p className="text-6xl">✓</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                Handed Off
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Great work this shift!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Shift Briefing Card ──

interface ShiftBriefingData {
  shiftPeriod: string;
  completedTaskCount: number;
  remainingTaskCount: number;
  moodScoreAvg: number | null;
  handedOffAt: string;
}

interface ShiftBriefingCardProps {
  data: ShiftBriefingData;
  onDismiss: () => void;
}

export function ShiftBriefingCard({ data, onDismiss }: ShiftBriefingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-4 mt-2 rounded-2xl border border-border bg-card/90 backdrop-blur-sm p-4 shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            📋 Shift Briefing
          </h3>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            Previous {data.shiftPeriod} shift
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss shift briefing"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 min-h-[44px] rounded-lg hover:bg-muted"
        >
          Dismiss
        </button>
      </div>
      <div className="flex gap-4 mt-3 text-center">
        <div className="flex-1">
          <p className="text-lg font-bold text-emerald-600">{data.completedTaskCount}</p>
          <p className="text-[10px] text-muted-foreground">Completed</p>
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-amber-600">{data.remainingTaskCount}</p>
          <p className="text-[10px] text-muted-foreground">Remaining</p>
        </div>
        <div className="flex-1">
          <p className="text-lg">{getMoodEmoji(data.moodScoreAvg)}</p>
          <p className="text-[10px] text-muted-foreground">Mood</p>
        </div>
      </div>
    </motion.div>
  );
}
