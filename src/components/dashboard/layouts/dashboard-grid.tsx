"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import { SeasonalTheme } from "@/components/dashboard/seasonal-theme";
import type { DashboardLayoutProps } from "./layout-props";

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function DashboardGridLayout({
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
  const circumference = 2 * Math.PI * 36;
  const strokeDash = (completionRate / 100) * circumference;

  return (
    <div data-scroll-sync="main" className="flex-1 overflow-y-auto">
      <div className="px-4 py-4 space-y-4">
        {/* Top Row: 3 Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Points Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Points Today</p>
                <motion.p key={pointsToday} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-black text-foreground mt-1">
                  {pointsToday}
                </motion.p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--hub-red)] to-[#c4001f]">
                <Trophy className="h-6 w-6 text-yellow-300" />
              </div>
            </div>
          </div>

          {/* Progress Ring Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                  <motion.circle
                    cx="40" cy="40" r="36" fill="none" strokeWidth="5" strokeLinecap="round"
                    className="text-[var(--hub-red)]"
                    stroke="currentColor"
                    initial={{ strokeDasharray: `0 ${circumference}` }}
                    animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                    transition={{ duration: 1 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-foreground">{completionRate}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Progress</p>
                <p className="text-lg font-bold text-foreground">{completedTasks.length}/{totalToday}</p>
                <p className="text-[10px] text-muted-foreground">tasks done</p>
              </div>
            </div>
          </div>

          {/* Streak / Status Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                {completionRate === 100 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 mt-1">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <span className="text-lg font-black text-foreground">All Done!</span>
                  </motion.div>
                ) : (
                  <p className="text-lg font-bold text-foreground mt-1">
                    {allTasks.filter((t) => !t.isCompleted && t.isOverdue).length > 0
                      ? `${allTasks.filter((t) => !t.isCompleted && t.isOverdue).length} overdue`
                      : allTasks.filter((t) => !t.isCompleted && t.isDueSoon).length > 0
                      ? `${allTasks.filter((t) => !t.isCompleted && t.isDueSoon).length} due soon`
                      : "On track"}
                  </p>
                )}
              </div>
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                completionRate === 100 ? "bg-yellow-100 dark:bg-yellow-950" : "bg-muted"
              )}>
                <Flame className={cn("h-6 w-6", completionRate === 100 ? "text-yellow-500" : "text-orange-500")} />
              </div>
            </div>
            <div className="mt-2">
              <SeasonalTheme showFloating={false} />
            </div>
          </div>
        </div>

        {/* Middle: Full-width Task Timeline */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm min-h-[300px]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Today&apos;s Tasks</h3>
          {currentTime && (
            <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
          )}
        </div>

        {/* Bottom Row: 3 Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Completed Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm max-h-[280px] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-foreground">Completed ({completedTasks.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {completedTasks.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-3">No tasks completed yet</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 px-2.5 py-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="flex-1 text-[10px] text-muted-foreground line-through truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leaderboard Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm max-h-[280px] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <h3 className="text-xs font-bold text-foreground">Leaderboard</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Leaderboard currentLocationId={currentLocationId} compact />
            </div>
          </div>

          {/* Upcoming Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm max-h-[280px] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <h3 className="text-xs font-bold text-foreground">Upcoming</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
            </div>
          </div>
        </div>

        {/* Motivational Quote */}
        <MotivationalQuote />
      </div>
    </div>
  );
}
