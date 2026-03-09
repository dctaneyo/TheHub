"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  SprayCan,
  Star,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import type { TaskItem } from "@/components/dashboard/timeline";
import type { DashboardLayoutProps } from "./layout-props";

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const typeIcons: Record<string, typeof Clock> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
};

export function BentoLayout({
  allTasks,
  completedTasks,
  missedYesterday,
  pointsToday,
  totalToday,
  currentTime,
  currentLocationId,
  onComplete,
}: DashboardLayoutProps) {
  const completionRate = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDash = (completionRate / 100) * circumference;
  const pendingTasks = allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  const overdueCount = pendingTasks.filter((t) => t.isOverdue).length;
  const dueSoonCount = pendingTasks.filter((t) => t.isDueSoon && !t.isOverdue).length;

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Bento Grid */}
        <div className="grid grid-cols-12 grid-rows-[auto] gap-4">

          {/* ── Hero Progress Ring — large, spans 4 cols ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="col-span-12 md:col-span-4 row-span-2 rounded-3xl bg-gradient-to-br from-[var(--hub-red)] via-rose-600 to-pink-700 p-6 text-white shadow-xl shadow-red-200/40 dark:shadow-red-950/40 relative overflow-hidden"
          >
            {/* Glass overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-3">
              <div className="relative">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                  <motion.circle
                    cx="60" cy="60" r="54" fill="none" strokeWidth="8" strokeLinecap="round"
                    stroke="white"
                    initial={{ strokeDasharray: `0 ${circumference}` }}
                    animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span key={completionRate} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-4xl font-black">
                    {completionRate}%
                  </motion.span>
                  <span className="text-[10px] font-medium text-white/60 uppercase tracking-widest">Complete</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{completedTasks.length} of {totalToday} tasks</p>
                {completionRate === 100 && (
                  <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-yellow-300 font-bold mt-1 flex items-center gap-1 justify-center">
                    <Sparkles className="h-4 w-4" /> All done! Amazing!
                  </motion.p>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Points Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-6 md:col-span-4 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Points</p>
                <motion.p key={pointsToday} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-black text-slate-900 dark:text-white">
                  {pointsToday}
                </motion.p>
              </div>
            </div>
          </motion.div>

          {/* ── Status Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="col-span-6 md:col-span-4 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                overdueCount > 0 ? "bg-red-100 dark:bg-red-900/40" : dueSoonCount > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"
              )}>
                {overdueCount > 0 ? (
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                ) : dueSoonCount > 0 ? (
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {overdueCount > 0 ? `${overdueCount} overdue` : dueSoonCount > 0 ? `${dueSoonCount} due soon` : completionRate === 100 ? "All clear" : "On track"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Streak/Quote Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-12 md:col-span-4 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 p-5 text-white shadow-lg shadow-violet-200/40 dark:shadow-violet-950/40 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent_50%)]" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-yellow-300" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Daily Motivation</span>
              </div>
              <MotivationalQuote />
            </div>
          </motion.div>

          {/* ── Today's Tasks — large card, spans 8 cols ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="col-span-12 lg:col-span-8 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Today&apos;s Tasks</h2>
              <span className="text-xs text-slate-400 font-medium">{pendingTasks.length} remaining</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {pendingTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Sparkles className="h-10 w-10 mb-2 text-yellow-400" />
                  <p className="font-bold text-slate-900 dark:text-white text-lg">All tasks completed!</p>
                  <p className="text-sm">Take a well-earned breather.</p>
                </div>
              ) : (
                pendingTasks.map((task, i) => {
                  const Icon = typeIcons[task.type] || ClipboardList;
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className={cn(
                        "group flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all hover:shadow-md cursor-pointer",
                        task.isOverdue
                          ? "border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30"
                          : task.isDueSoon
                          ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          : "border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                      onClick={() => onComplete(task.id)}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        task.isOverdue ? "bg-red-100 dark:bg-red-900/40" : task.isDueSoon ? "bg-amber-100 dark:bg-amber-900/40" : "bg-slate-100 dark:bg-slate-700/50"
                      )}>
                        <Icon className={cn(
                          "h-5 w-5",
                          task.isOverdue ? "text-red-500" : task.isDueSoon ? "text-amber-500" : "text-slate-400 dark:text-slate-500"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {task.isOverdue && <span className="text-[9px] font-bold text-red-500 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">OVERDUE</span>}
                          {task.isDueSoon && !task.isOverdue && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">DUE SOON</span>}
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{task.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{formatTime12(task.dueTime)} · {task.points} pts · {task.priority}</p>
                      </div>
                      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hub-red)] text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-lg shadow-red-300/30 dark:shadow-red-900/30">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* ── Right Stack: Completed + Missed + Leaderboard ── */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            {/* Completed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Completed</span>
                <span className="ml-auto text-xs text-slate-400 font-medium">{completedTasks.length}</span>
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {completedTasks.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-3">Nothing yet — you got this!</p>
                ) : (
                  completedTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="flex-1 text-[11px] text-slate-500 line-through truncate">{task.title}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Missed */}
            {missedYesterday.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-3xl bg-white dark:bg-slate-800/80 border border-red-100 dark:border-red-900/30 p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Missed Yesterday</span>
                  <span className="ml-auto text-xs text-red-400 font-medium">{missedYesterday.length}</span>
                </div>
                <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                  {missedYesterday.map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 rounded-xl bg-red-50/60 dark:bg-red-950/20 px-3 py-2">
                      <XCircle className="h-3.5 w-3.5 text-red-300 shrink-0" />
                      <span className="flex-1 text-[11px] text-slate-500 truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm backdrop-blur-sm flex-1"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Leaderboard</span>
              </div>
              <Leaderboard currentLocationId={currentLocationId} compact />
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
