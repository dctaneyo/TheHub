"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Trophy,
  XCircle,
  Star,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import type { TaskItem } from "@/components/dashboard/timeline";
import type { DashboardLayoutProps } from "./layout-props";

export function ZenLayout({
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-rose-50/50 via-white to-sky-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      {/* Decorative blurs */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-rose-100/40 dark:bg-rose-950/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-sky-100/40 dark:bg-sky-950/10 blur-3xl pointer-events-none" />

      {/* Inline stat strip — very calm */}
      <div className="shrink-0 px-5 pt-3 pb-2 relative z-10">
        <div className="flex items-center gap-4">
          {/* Progress pill */}
          <div className="flex items-center gap-2.5 rounded-full bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-slate-700/40 px-4 py-2 shadow-sm">
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
                <motion.circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round" className="text-emerald-500"
                  initial={{ strokeDasharray: "0 94.2" }} animate={{ strokeDasharray: `${(completionRate / 100) * 94.2} ${94.2 - (completionRate / 100) * 94.2}` }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300">{completionRate}%</span>
            </div>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{completedTasks.length}/{totalToday}</span>
          </div>

          {/* Points */}
          <div className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-slate-700/40 px-4 py-2 shadow-sm">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{pointsToday}</span>
          </div>

          {/* Spacer + Quote */}
          <div className="flex-1" />
          <div className="hidden lg:block max-w-[250px] text-right">
            <MotivationalQuote />
          </div>
        </div>
      </div>

      {/* 3-Column Body */}
      <div className="flex flex-1 overflow-hidden gap-3 px-4 pb-3 relative z-10">
        {/* Left: Completed + Missed */}
        <div className="w-[250px] shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Completed */}
          <div className="flex-1 min-h-0 rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 shadow-sm overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</span>
              <span className="ml-auto text-[10px] text-slate-400 font-medium">{completedTasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {completedTasks.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-4">Nothing yet</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 px-2.5 py-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 line-through truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missed */}
          <div className="shrink-0 rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-rose-200/40 dark:border-red-900/20 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <XCircle className="h-3.5 w-3.5 text-red-300" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Missed</span>
              <span className="ml-auto text-[10px] text-red-400 font-medium">{missedYesterday.length}</span>
            </div>
            <div className="max-h-[120px] overflow-y-auto px-3 pb-3 space-y-1">
              {missedYesterday.length === 0 ? (
                <p className="text-[10px] text-emerald-500 text-center py-2">None</p>
              ) : (
                missedYesterday.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl bg-red-50/40 dark:bg-red-950/10 px-2.5 py-1.5">
                    <XCircle className="h-2.5 w-2.5 text-red-300 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Timeline */}
        <div className="flex-1 min-w-0 rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* Right: Upcoming + Leaderboard */}
        <div className="w-[270px] shrink-0 flex flex-col gap-3 overflow-hidden hidden lg:flex">
          {/* Upcoming */}
          <div className="flex-1 min-h-0 rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 shadow-sm overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upcoming</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
            </div>
          </div>

          {/* Leaderboard */}
          <div className="shrink-0 max-h-[200px] rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 shadow-sm overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leaderboard</span>
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
