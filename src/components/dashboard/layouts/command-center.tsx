"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  Flame,
  MessageCircle,
  CalendarDays,
  FileText,
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

export function CommandCenterLayout({
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
  const [dockTab, setDockTab] = useState<"completed" | "missed">("completed");
  const [rightTab, setRightTab] = useState<"calendar" | "leaderboard">("calendar");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Hero Stats Strip */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Points */}
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--hub-red)] to-[#c4001f] px-4 py-2 text-white shadow-sm">
            <Trophy className="h-4 w-4 text-yellow-300" />
            <div>
              <p className="text-[9px] font-medium text-white/70 leading-none">Points</p>
              <motion.p key={pointsToday} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-lg font-black leading-none">
                {pointsToday}
              </motion.p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground font-medium">Progress</span>
              <span className="font-bold text-foreground">{completedTasks.length}/{totalToday}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--hub-red)]"
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>

          {/* Streak placeholder */}
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-muted px-4 py-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-[9px] font-medium text-muted-foreground leading-none">Today</p>
              <p className="text-sm font-bold text-foreground leading-none">{completionRate}%</p>
            </div>
          </div>

          {completionRate === 100 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 text-xs font-bold text-yellow-600 dark:text-yellow-400">
              <Sparkles className="h-4 w-4" /> All done!
            </motion.div>
          )}

          <div className="ml-auto">
            <SeasonalTheme showFloating={false} />
          </div>
        </div>
      </div>

      {/* Main 3-panel area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Dock — Completed/Missed */}
        <div className="w-[220px] shrink-0 border-r border-border bg-card overflow-hidden hidden md:flex flex-col">
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => setDockTab("completed")}
              className={cn("flex-1 py-2 text-[10px] font-semibold transition-colors", dockTab === "completed" ? "border-b-2 border-[var(--hub-green)] text-[var(--hub-green)]" : "text-muted-foreground")}
            >
              <CheckCircle2 className="h-3 w-3 inline mr-1" />Completed ({completedTasks.length})
            </button>
            <button
              onClick={() => setDockTab("missed")}
              className={cn("flex-1 py-2 text-[10px] font-semibold transition-colors", dockTab === "missed" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-muted-foreground")}
            >
              <XCircle className="h-3 w-3 inline mr-1" />Missed ({missedYesterday.length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {dockTab === "completed" ? (
              completedTasks.length === 0 ? (
                <p className="text-center text-[10px] text-muted-foreground py-4">No tasks completed yet</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 px-2.5 py-1.5">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    <span className="flex-1 truncate text-[10px] text-muted-foreground line-through">{task.title}</span>
                  </div>
                ))
              )
            ) : (
              missedYesterday.length === 0 ? (
                <p className="text-center text-[10px] text-muted-foreground py-4">No missed tasks!</p>
              ) : (
                missedYesterday.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg bg-red-50/50 dark:bg-red-950/30 px-2.5 py-1.5">
                    <XCircle className="h-3 w-3 shrink-0 text-red-400" />
                    <span className="flex-1 truncate text-[10px] text-muted-foreground">{task.title}</span>
                  </div>
                ))
              )
            )}
          </div>
          <div className="shrink-0 p-3 pt-0">
            <MotivationalQuote />
          </div>
        </div>

        {/* Center — Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* Right — Calendar/Leaderboard */}
        <div className="w-[280px] shrink-0 border-l border-border bg-card overflow-hidden hidden lg:flex flex-col">
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => setRightTab("calendar")}
              className={cn("flex-1 py-2 text-[10px] font-semibold transition-colors", rightTab === "calendar" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-muted-foreground")}
            >
              Upcoming
            </button>
            <button
              onClick={() => setRightTab("leaderboard")}
              className={cn("flex-1 py-2 text-[10px] font-semibold transition-colors", rightTab === "leaderboard" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-muted-foreground")}
            >
              🏆 Leaderboard
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {rightTab === "calendar" ? (
              <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
            ) : (
              <Leaderboard currentLocationId={currentLocationId} compact />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
