"use client";

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
import type { TaskItem } from "@/components/dashboard/timeline";
import type { DashboardLayoutProps } from "./layout-props";

// Time-of-day gradient backgrounds
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
  const completionRate = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const gradient = getTimeGradient();
  const greeting = getGreeting();
  const isNight = new Date().getHours() >= 21 || new Date().getHours() < 5;

  const cardBg = isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30";
  const textPrimary = isNight ? "text-white" : "text-slate-900 dark:text-white";
  const textSecondary = isNight ? "text-slate-400" : "text-slate-500 dark:text-slate-400";
  const textMuted = isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500";

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden bg-gradient-to-br", gradient, "relative")}>
      {/* Decorative orbs */}
      <div className="absolute top-10 left-[8%] w-64 h-64 rounded-full bg-white/15 dark:bg-white/3 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-[12%] w-56 h-56 rounded-full bg-white/10 dark:bg-white/2 blur-[60px] pointer-events-none" />

      {/* Top stat strip */}
      <div className="shrink-0 px-5 pt-3 pb-2 relative z-10">
        <div className="flex items-center gap-3">
          {/* Greeting */}
          <p className={cn("text-sm font-medium mr-2", textSecondary)}>{greeting}</p>

          {/* Stats pills */}
          <div className={cn("flex items-center gap-2 rounded-full backdrop-blur-md border px-3 py-1.5 shadow-sm", cardBg)}>
            <Flame className="h-4 w-4 text-orange-500" />
            <span className={cn("text-sm font-bold", textPrimary)}>{completionRate}%</span>
            <span className={cn("text-[10px]", textMuted)}>done</span>
          </div>

          <div className={cn("flex items-center gap-2 rounded-full backdrop-blur-md border px-3 py-1.5 shadow-sm", cardBg)}>
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className={cn("text-sm font-bold", textPrimary)}>{pointsToday}</span>
            <span className={cn("text-[10px]", textMuted)}>pts</span>
          </div>

          <div className={cn("flex items-center gap-2 rounded-full backdrop-blur-md border px-3 py-1.5 shadow-sm", cardBg)}>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className={cn("text-sm font-bold", textPrimary)}>{completedTasks.length}/{totalToday}</span>
          </div>

          {/* Spacer + Quote */}
          <div className="flex-1" />
          <div className="hidden lg:block max-w-[220px] text-right">
            <MotivationalQuote />
          </div>
        </div>
      </div>

      {/* 3-Column Body */}
      <div className="flex flex-1 overflow-hidden gap-3 px-4 pb-3 relative z-10">
        {/* Left: Completed + Missed */}
        <div className="w-[250px] shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Completed */}
          <div className={cn("flex-1 min-h-0 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", textMuted)}>Completed</span>
              <span className={cn("ml-auto text-[10px] font-medium", textMuted)}>{completedTasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {completedTasks.length === 0 ? (
                <p className={cn("text-[10px] text-center py-4", textMuted)}>Nothing yet</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl bg-emerald-500/5 px-2.5 py-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                    <span className={cn("flex-1 text-[10px] line-through truncate", textMuted)}>{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missed */}
          <div className={cn("shrink-0 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden",
            isNight ? "bg-red-950/10 border-red-800/20" : "bg-white/60 dark:bg-slate-800/40 border-red-200/30 dark:border-red-900/20"
          )}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <XCircle className="h-3.5 w-3.5 text-red-300" />
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", textMuted)}>Missed</span>
              <span className="ml-auto text-[10px] text-red-400 font-medium">{missedYesterday.length}</span>
            </div>
            <div className="max-h-[120px] overflow-y-auto px-3 pb-3 space-y-1">
              {missedYesterday.length === 0 ? (
                <p className="text-[10px] text-emerald-500 text-center py-2">None</p>
              ) : (
                missedYesterday.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl bg-red-500/5 px-2.5 py-1.5">
                    <XCircle className="h-2.5 w-2.5 text-red-300 shrink-0" />
                    <span className={cn("flex-1 text-[10px] truncate", textMuted)}>{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Timeline */}
        <div className={cn("flex-1 min-w-0 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* Right: Upcoming + Leaderboard */}
        <div className="w-[270px] shrink-0 flex flex-col gap-3 overflow-hidden hidden lg:flex">
          {/* Upcoming */}
          <div className={cn("flex-1 min-h-0 rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", textMuted)}>Upcoming</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
            </div>
          </div>

          {/* Leaderboard */}
          <div className={cn("shrink-0 max-h-[200px] rounded-2xl backdrop-blur-md border shadow-sm overflow-hidden flex flex-col", cardBg)}>
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", textMuted)}>Leaderboard</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <Leaderboard currentLocationId={currentLocationId} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
