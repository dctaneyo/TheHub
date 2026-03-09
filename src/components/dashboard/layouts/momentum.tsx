"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
  Flame,
  XCircle,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import type { DashboardLayoutProps } from "./layout-props";

/*
 * MOMENTUM — Hero band + 4-pane strip
 *
 * Structure:
 *   Top hero band (~35%):  Large centered display of next task + big progress ring
 *                          Flanked by stats (points, completed, missed, quote)
 *   Bottom strip (~65%):   4 equal horizontal panes filling remaining height
 *                          [Completed] [Timeline] [Upcoming] [Leaderboard]
 *
 * Visual: Time-of-day gradient bg, glassmorphic panels, decorative blur orbs.
 * Structurally: 2 vertical zones, bottom zone has 4 horizontal panes.
 */

function getTimeGradient(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return "from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/30";
  if (h >= 8 && h < 12) return "from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-indigo-950/20";
  if (h >= 12 && h < 16) return "from-cyan-50 via-sky-50 to-blue-50 dark:from-cyan-950/20 dark:via-sky-950/20 dark:to-blue-950/20";
  if (h >= 16 && h < 19) return "from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-yellow-950/20";
  if (h >= 19 && h < 21) return "from-violet-100 via-purple-50 to-indigo-100 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-indigo-950/30";
  return "from-slate-900 via-indigo-950 to-slate-950 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function MomentumLayout({
  allTasks,
  completedTasks,
  missedYesterday,
  pointsToday,
  totalToday,
  currentTime,
  upcomingTasks,
  currentLocationId,
  onComplete,
  onUncomplete,
  onEarlyComplete,
}: DashboardLayoutProps) {
  const pct = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const circ = 2 * Math.PI * 52;
  const dash = (pct / 100) * circ;
  const gradient = getTimeGradient();
  const greeting = getGreeting();
  const isNight = new Date().getHours() >= 21 || new Date().getHours() < 5;
  const nextTask = useMemo(
    () => allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime))[0],
    [allTasks]
  );

  const textP = isNight ? "text-white" : "text-slate-900 dark:text-white";
  const textS = isNight ? "text-slate-400" : "text-slate-500 dark:text-slate-400";
  const textM = isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500";
  const cardBg = isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30";

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden bg-gradient-to-br", gradient, "relative")}>
      <div className="absolute top-10 left-[8%] w-64 h-64 rounded-full bg-white/15 dark:bg-white/3 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-[12%] w-56 h-56 rounded-full bg-white/10 dark:bg-white/2 blur-[60px] pointer-events-none" />

      {/* ═══ ZONE 1: Hero Band ═══ */}
      <div className="shrink-0 flex items-center justify-center gap-8 px-6 py-5 relative z-10">
        {/* Left stats */}
        <div className="hidden lg:flex flex-col gap-2 items-end w-[180px]">
          <div className={cn("rounded-2xl backdrop-blur-md border px-4 py-2.5 shadow-sm w-full", cardBg)}>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <p className={cn("text-lg font-black", textP)}>{pointsToday}</p>
                <p className={cn("text-[8px] uppercase tracking-wider", textM)}>Points</p>
              </div>
            </div>
          </div>
          <div className={cn("rounded-2xl backdrop-blur-md border px-4 py-2.5 shadow-sm w-full", missedYesterday.length > 0 ? (isNight ? "bg-red-950/10 border-red-800/20" : "bg-red-50/60 border-red-200/40") : cardBg)}>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className={cn("text-lg font-black", textP)}>{missedYesterday.length}</p>
                <p className={cn("text-[8px] uppercase tracking-wider", textM)}>Missed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center: progress ring + next task */}
        <div className="flex items-center gap-6">
          {/* Big ring */}
          <div className="relative h-28 w-28 shrink-0">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="6" className={isNight ? "stroke-white/10" : "stroke-slate-200 dark:stroke-slate-700"} />
              <motion.circle cx="60" cy="60" r="52" fill="none" strokeWidth="6" strokeLinecap="round"
                className={pct === 100 ? "stroke-emerald-500" : "stroke-[var(--hub-red)]"}
                initial={{ strokeDasharray: `0 ${circ}` }}
                animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
                transition={{ duration: 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-black", textP)}>{pct}%</span>
              <span className={cn("text-[8px] uppercase tracking-wider", textM)}>{completedTasks.length}/{totalToday}</span>
            </div>
          </div>

          {/* Next task info */}
          <div className="max-w-[300px]">
            <p className={cn("text-xs font-medium mb-1", textS)}>{greeting}</p>
            {nextTask ? (
              <>
                <p className={cn("text-xs uppercase tracking-wider font-semibold mb-0.5",
                  nextTask.isOverdue ? "text-red-500" : nextTask.isDueSoon ? "text-amber-500" : textM
                )}>
                  {nextTask.isOverdue ? "Overdue" : nextTask.isDueSoon ? "Due soon" : "Up next"} · {formatTime12(nextTask.dueTime)}
                </p>
                <h2 className={cn("text-2xl font-black leading-tight tracking-tight", textP)}>{nextTask.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={cn("text-xs font-medium flex items-center gap-1", textS)}>
                    <Sparkles className="h-3 w-3 text-amber-500" /> {nextTask.points} pts
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onComplete(nextTask.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--hub-red)] px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:brightness-110 transition-all"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </motion.button>
                </div>
              </>
            ) : (
              <>
                <h2 className={cn("text-2xl font-black leading-tight tracking-tight", textP)}>All clear!</h2>
                <p className={cn("text-sm mt-1", textS)}>Every task is done. {pointsToday} points earned.</p>
              </>
            )}
          </div>
        </div>

        {/* Right stats */}
        <div className="hidden lg:flex flex-col gap-2 items-start w-[180px]">
          <div className={cn("rounded-2xl backdrop-blur-md border px-4 py-2.5 shadow-sm w-full", cardBg)}>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <p className={cn("text-lg font-black", textP)}>{completedTasks.length}</p>
                <p className={cn("text-[8px] uppercase tracking-wider", textM)}>Done Today</p>
              </div>
            </div>
          </div>
          <div className={cn("rounded-2xl backdrop-blur-md border px-4 py-2.5 shadow-sm w-full", cardBg)}>
            <MotivationalQuote />
          </div>
        </div>
      </div>

      {/* ═══ ZONE 2: 4-Pane Strip ═══ */}
      <div className="flex-1 flex gap-3 px-3 pb-3 overflow-hidden relative z-10">
        {/* Completed */}
        <div className={cn("flex-1 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
          <div className="shrink-0 flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className={cn("text-[9px] font-semibold uppercase tracking-wider", textM)}>Completed</span>
            <span className={cn("ml-auto text-[9px]", textM)}>{completedTasks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5">
            {completedTasks.length === 0 ? (
              <p className={cn("text-[9px] text-center py-3", textM)}>Nothing yet</p>
            ) : completedTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/5 px-2 py-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                <span className={cn("flex-1 text-[9px] line-through truncate", textM)}>{t.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline (widest) */}
        <div className={cn("flex-[2] rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* Upcoming */}
        <div className={cn("flex-1 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
          <div className="shrink-0 flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-400" />
            <span className={cn("text-[9px] font-semibold uppercase tracking-wider", textM)}>Upcoming</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2.5 pb-2">
            <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
          </div>
        </div>

        {/* Leaderboard */}
        <div className={cn("flex-1 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
          <div className="shrink-0 flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className={cn("text-[9px] font-semibold uppercase tracking-wider", textM)}>Leaderboard</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2.5 pb-2">
            <Leaderboard currentLocationId={currentLocationId} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
