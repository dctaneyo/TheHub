"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Trophy,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/components/dashboard/timeline";
import type { DashboardLayoutProps } from "./layout-props";

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Soft pastel backgrounds that cycle per task
const softBgs = [
  "from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20",
  "from-sky-50 to-indigo-50 dark:from-sky-950/20 dark:to-indigo-950/20",
  "from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
  "from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20",
  "from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20",
];

export function ZenLayout({
  allTasks,
  completedTasks,
  missedYesterday,
  pointsToday,
  totalToday,
  currentTime,
  onComplete,
}: DashboardLayoutProps) {
  const completionRate = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const pendingTasks = useMemo(
    () => allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime)),
    [allTasks]
  );
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(0); // -1 left, 1 right

  const safeIdx = Math.min(idx, Math.max(pendingTasks.length - 1, 0));
  const task = pendingTasks[safeIdx];
  const bgClass = softBgs[safeIdx % softBgs.length];

  const goNext = () => { setDirection(1); setIdx((i) => Math.min(i + 1, pendingTasks.length - 1)); };
  const goPrev = () => { setDirection(-1); setIdx((i) => Math.max(i - 1, 0)); };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div className={cn("flex-1 flex flex-col items-center justify-center bg-gradient-to-br transition-colors duration-700", bgClass, "relative overflow-hidden")}>
      {/* Subtle decorative circles */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/30 dark:bg-white/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/20 dark:bg-white/3 blur-3xl pointer-events-none" />

      {/* Progress dots at top */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {allTasks.map((t, i) => (
          <motion.div
            key={t.id}
            className={cn(
              "rounded-full transition-all duration-300",
              t.isCompleted
                ? "h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                : i === allTasks.indexOf(task)
                ? "h-3 w-3 bg-[var(--hub-red)] shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                : t.isOverdue
                ? "h-2.5 w-2.5 bg-red-300 dark:bg-red-600"
                : "h-2 w-2 bg-slate-300 dark:bg-slate-600"
            )}
            layout
          />
        ))}
      </div>

      {/* Stats row */}
      <div className="absolute top-6 right-8 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold text-slate-600 dark:text-slate-400 tabular-nums">{pointsToday}</span>
        </div>
        <div className="text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">
          {completedTasks.length}/{totalToday}
        </div>
      </div>

      {/* Main content area */}
      <div className="w-full max-w-lg px-8">
        {pendingTasks.length === 0 ? (
          /* All done state */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="h-20 w-20 text-amber-400 mx-auto mb-6" />
            </motion.div>
            <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">All done.</h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 mt-3 font-medium">
              {completedTasks.length} tasks · {pointsToday} points
            </p>
            <p className="text-base text-slate-400 dark:text-slate-500 mt-2">
              Take a breath. You earned it.
            </p>
          </motion.div>
        ) : task ? (
          /* Single task focus */
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={task.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="text-center"
            >
              {/* Time badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-slate-700/40 px-4 py-1.5 mb-6 shadow-sm">
                {task.isOverdue ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span className={cn(
                  "text-sm font-semibold",
                  task.isOverdue ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"
                )}>
                  {task.isOverdue ? "Overdue · " : task.isDueSoon ? "Due soon · " : ""}{formatTime12(task.dueTime)}
                </span>
              </div>

              {/* Task title — BIG */}
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {task.title}
              </h1>

              {/* Description if present */}
              {task.description && (
                <p className="text-lg text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto">
                  {task.description}
                </p>
              )}

              {/* Points */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-base font-bold text-slate-500 dark:text-slate-400">{task.points} points</span>
              </div>

              {/* Complete button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onComplete(task.id)}
                className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-[var(--hub-red)] px-10 py-4 text-lg font-bold text-white shadow-xl shadow-red-200/40 dark:shadow-red-950/40 transition-all hover:brightness-110"
              >
                <CheckCircle2 className="h-5 w-5" />
                Done
              </motion.button>

              {/* Task counter */}
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-5">
                Task {safeIdx + 1} of {pendingTasks.length} remaining
              </p>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      {/* Navigation arrows */}
      {pendingTasks.length > 1 && (
        <>
          <button
            onClick={goPrev}
            disabled={safeIdx === 0}
            className={cn(
              "absolute left-6 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-slate-700/40 shadow-sm transition-all",
              safeIdx === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-white dark:hover:bg-slate-700 hover:scale-105"
            )}
          >
            <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={goNext}
            disabled={safeIdx >= pendingTasks.length - 1}
            className={cn(
              "absolute right-6 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-slate-700/40 shadow-sm transition-all",
              safeIdx >= pendingTasks.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white dark:hover:bg-slate-700 hover:scale-105"
            )}
          >
            <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
        </>
      )}

      {/* Bottom: completed list (subtle) */}
      {completedTasks.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-md w-full px-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Completed today</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {completedTasks.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-2.5 py-1 text-[10px] text-slate-500 border border-white/40 dark:border-slate-700/40">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
