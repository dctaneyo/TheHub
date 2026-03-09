"use client";

import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ClipboardList,
  SprayCan,
  Star,
  Flame,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import { SeasonalTheme } from "@/components/dashboard/seasonal-theme";
import type { TaskItem } from "@/components/dashboard/timeline";
import type { DashboardLayoutProps } from "./layout-props";

export function BentoLayout({
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
  const circumference = 2 * Math.PI * 38;
  const strokeDash = (completionRate / 100) * circumference;
  const overdueCount = allTasks.filter((t) => !t.isCompleted && t.isOverdue).length;
  const dueSoonCount = allTasks.filter((t) => !t.isCompleted && t.isDueSoon && !t.isOverdue).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Top Stat Strip — fixed, never scrolls */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {/* Progress Ring */}
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[var(--hub-red)] via-rose-600 to-pink-700 px-4 py-2.5 text-white shadow-lg shadow-red-200/30 dark:shadow-red-950/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
            <div className="relative h-14 w-14 shrink-0">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                <motion.circle cx="42" cy="42" r="38" fill="none" strokeWidth="5" strokeLinecap="round" stroke="white"
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                  transition={{ duration: 1 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black">{completionRate}%</span>
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-base font-bold">{completedTasks.length}/{totalToday}</p>
              <p className="text-[9px] text-white/60 uppercase tracking-wider">Tasks Done</p>
            </div>
          </div>

          {/* Points */}
          <div className="rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 px-4 py-2.5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Points</p>
                <motion.p key={pointsToday} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-2xl font-black text-slate-900 dark:text-white">{pointsToday}</motion.p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className={cn(
            "rounded-2xl border px-4 py-2.5 shadow-sm backdrop-blur-sm",
            overdueCount > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40" : dueSoonCount > 0 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40" : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/50"
          )}>
            <div className="flex items-center gap-2.5">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl",
                overdueCount > 0 ? "bg-red-100 dark:bg-red-900/40" : dueSoonCount > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"
              )}>
                {overdueCount > 0 ? <AlertTriangle className="h-5 w-5 text-red-500" /> : dueSoonCount > 0 ? <Clock className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Status</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {overdueCount > 0 ? `${overdueCount} overdue` : dueSoonCount > 0 ? `${dueSoonCount} due soon` : completionRate === 100 ? "All clear!" : "On track"}
                </p>
              </div>
            </div>
          </div>

          {/* Seasonal + Quote */}
          <div className="hidden lg:flex flex-1 items-center justify-end gap-3">
            <SeasonalTheme showFloating={false} />
            <div className="max-w-[220px]">
              <MotivationalQuote />
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Body — fills remaining viewport */}
      <div className="flex flex-1 overflow-hidden gap-3 px-4 pb-3">
        {/* Left: Completed + Missed */}
        <div className="w-[260px] shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Completed */}
          <div className="flex-1 min-h-0 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="h-5 w-5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Completed</span>
              <span className="ml-auto text-[10px] text-slate-400 font-medium">{completedTasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {completedTasks.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-4">Nothing yet — you got this!</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 line-through truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missed */}
          <div className="shrink-0 rounded-2xl bg-white dark:bg-slate-800/80 border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="h-5 w-5 rounded-md bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <XCircle className="h-3 w-3 text-red-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Missed</span>
              <span className="ml-auto text-[10px] text-red-400 font-medium">{missedYesterday.length}</span>
            </div>
            <div className="max-h-[120px] overflow-y-auto px-3 pb-3 space-y-1">
              {missedYesterday.length === 0 ? (
                <p className="text-[10px] text-emerald-500 text-center py-2">None — great job!</p>
              ) : (
                missedYesterday.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl bg-red-50/60 dark:bg-red-950/20 px-2.5 py-1.5">
                    <XCircle className="h-3 w-3 text-red-300 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Timeline */}
        <div className="flex-1 min-w-0 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* Right: Upcoming + Leaderboard */}
        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-hidden hidden lg:flex">
          {/* Upcoming */}
          <div className="flex-1 min-h-0 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="h-5 w-5 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Clock className="h-3 w-3 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Upcoming</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
            </div>
          </div>

          {/* Leaderboard */}
          <div className="shrink-0 max-h-[220px] rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="h-5 w-5 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Trophy className="h-3 w-3 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Leaderboard</span>
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
