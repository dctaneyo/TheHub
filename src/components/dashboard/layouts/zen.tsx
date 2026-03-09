"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Trophy,
  XCircle,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import type { DashboardLayoutProps } from "./layout-props";

/*
 * ZEN — 2-panel split layout (no left sidebar)
 *
 * Structure:
 *   Left ~65%:  Full-height timeline with a thin inline progress bar at the top
 *   Right ~35%: Vertical stack of info cards:
 *               [Stats bar] [Completed] [Missed] [Upcoming] [Leaderboard] [Quote]
 *
 * Visual: Pastel gradient bg, frosted glass panels, decorative blur orbs.
 * Structurally: 2 panels, NOT 3 columns. Right panel stacks everything vertically.
 */

const glass = "rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 shadow-sm";

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
  const pct = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;

  return (
    <div className="flex-1 flex overflow-hidden bg-gradient-to-br from-rose-50/60 via-white to-sky-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative p-3 gap-3">
      {/* Decorative blurs */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-rose-100/40 dark:bg-rose-950/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-sky-100/40 dark:bg-sky-950/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-60 h-60 rounded-full bg-violet-100/20 dark:bg-violet-950/5 blur-3xl pointer-events-none" />

      {/* ═══ LEFT PANEL: Timeline (~65%) ═══ */}
      <div className="flex-[65] min-w-0 flex flex-col overflow-hidden relative z-10">
        {/* Thin progress bar */}
        <div className="shrink-0 mb-2 px-1">
          <div className="h-1.5 rounded-full bg-slate-200/60 dark:bg-slate-700/40 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
              initial={{ width: "0%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 px-0.5">
            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{completedTasks.length}/{totalToday} tasks · {pct}%</span>
            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{pointsToday} pts</span>
          </div>
        </div>

        {/* Timeline card */}
        <div className={cn(glass, "flex-1 flex flex-col overflow-hidden")}>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Stacked info cards (~35%) ═══ */}
      <div className="flex-[35] min-w-[280px] max-w-[380px] flex flex-col gap-2.5 overflow-hidden relative z-10">
        {/* Stats bar */}
        <div className="shrink-0 flex gap-2.5">
          <div className={cn(glass, "flex-1 flex items-center justify-center gap-2 py-2.5 px-3")}>
            <div className="relative h-9 w-9 shrink-0">
              <svg className="h-9 w-9 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
                <motion.circle cx="20" cy="20" r="17" fill="none" strokeWidth="3" strokeLinecap="round" className="text-emerald-500"
                  initial={{ strokeDasharray: "0 106.8" }} animate={{ strokeDasharray: `${(pct / 100) * 106.8} ${106.8 - (pct / 100) * 106.8}` }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300">{pct}%</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{completedTasks.length}/{totalToday}</p>
              <p className="text-[8px] text-slate-400 uppercase tracking-wider">Tasks</p>
            </div>
          </div>
          <div className={cn(glass, "flex items-center justify-center gap-2 py-2.5 px-3")}>
            <Trophy className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{pointsToday}</p>
              <p className="text-[8px] text-slate-400 uppercase tracking-wider">Points</p>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className={cn(glass, "flex-1 min-h-0 flex flex-col overflow-hidden")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-2.5 pb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</span>
            <span className="ml-auto text-[9px] text-slate-400">{completedTasks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
            {completedTasks.length === 0 ? (
              <p className="text-[9px] text-slate-400 text-center py-2">Nothing yet</p>
            ) : completedTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 px-2.5 py-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                <span className="flex-1 text-[9px] text-slate-500 line-through truncate">{t.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missed */}
        <div className={cn(glass, "shrink-0 max-h-[100px] flex flex-col overflow-hidden", missedYesterday.length > 0 && "border-rose-200/50 dark:border-red-900/20")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-2.5 pb-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-300" />
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Missed</span>
            <span className="ml-auto text-[9px] text-red-400">{missedYesterday.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
            {missedYesterday.length === 0 ? (
              <p className="text-[9px] text-emerald-500 text-center py-1">None</p>
            ) : missedYesterday.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg bg-red-50/40 dark:bg-red-950/10 px-2.5 py-1">
                <XCircle className="h-2.5 w-2.5 text-red-300 shrink-0" />
                <span className="flex-1 text-[9px] text-slate-500 truncate">{t.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className={cn(glass, "flex-1 min-h-0 flex flex-col overflow-hidden")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-2.5 pb-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upcoming</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
          </div>
        </div>

        {/* Leaderboard */}
        <div className={cn(glass, "shrink-0 max-h-[140px] flex flex-col overflow-hidden")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-2.5 pb-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leaderboard</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            <Leaderboard currentLocationId={currentLocationId} compact />
          </div>
        </div>

        {/* Quote */}
        <div className={cn(glass, "shrink-0 px-4 py-2.5")}>
          <MotivationalQuote />
        </div>
      </div>
    </div>
  );
}
