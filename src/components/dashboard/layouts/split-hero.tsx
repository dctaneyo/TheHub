"use client";

import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ClipboardList,
  SprayCan,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import { SeasonalTheme } from "@/components/dashboard/seasonal-theme";
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

const priorityColors: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  normal: "border-l-blue-500",
  low: "border-l-gray-400",
};

export function SplitHeroLayout({
  allTasks,
  completedTasks,
  missedYesterday,
  pointsToday,
  totalToday,
  currentTime,
  currentLocationId,
  onComplete,
  onUncomplete,
}: DashboardLayoutProps) {
  const completionRate = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const pendingTasks = allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  const circumference = 2 * Math.PI * 40;
  const strokeDash = (completionRate / 100) * circumference;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel — Action (60%) */}
      <div className="flex-[3] flex flex-col overflow-hidden border-r border-border">
        {/* Inline stat chips */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-border bg-card/50">
          <div className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--hub-red)] to-[#c4001f] px-2.5 py-1 text-white text-[10px] font-bold">
            <Trophy className="h-3 w-3 text-yellow-300" />
            {pointsToday} pts
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
            {completedTasks.length}/{totalToday} done
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
            <Flame className="h-3 w-3 text-orange-500" />
            {completionRate}%
          </div>
          {completionRate === 100 && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-[10px] font-bold text-yellow-600">
              <Sparkles className="h-3 w-3" /> All done!
            </motion.span>
          )}
          <div className="ml-auto">
            <SeasonalTheme showFloating={false} />
          </div>
        </div>

        {/* Task List */}
        <div data-scroll-sync="main" className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Today&apos;s Tasks</h2>
          {pendingTasks.length === 0 && completedTasks.length > 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-base font-bold text-foreground">All tasks completed!</p>
            </div>
          )}
          {pendingTasks.map((task) => {
            const Icon = typeIcons[task.type] || ClipboardList;
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-l-4 border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/30",
                  priorityColors[task.priority] || "border-l-blue-500",
                  task.isOverdue && "bg-red-50/50 dark:bg-red-950/20 border-l-red-500",
                  task.isDueSoon && !task.isOverdue && "bg-amber-50/50 dark:bg-amber-950/20 border-l-amber-500"
                )}
              >
                <div className="shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {task.isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    {task.isDueSoon && !task.isOverdue && <Clock className="h-3 w-3 text-amber-500" />}
                    <p className="text-sm font-semibold text-foreground truncate">{task.title}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{formatTime12(task.dueTime)}</span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <span className="text-[10px] text-muted-foreground">{task.points} pts</span>
                    <span className={cn(
                      "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                      task.priority === "urgent" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" :
                      task.priority === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" :
                      "hidden"
                    )}>
                      {task.priority}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onComplete(task.id)}
                  className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hub-red)] text-white shadow-sm transition-transform active:scale-90 hover:brightness-110"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Right Panel — Status (40%) */}
      <div className="flex-[2] flex flex-col overflow-y-auto bg-card">
        {/* Progress Ring */}
        <div className="shrink-0 p-5 flex items-center gap-4 border-b border-border">
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="40" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
              <motion.circle
                cx="44" cy="44" r="40" fill="none" strokeWidth="4" strokeLinecap="round"
                className="text-[var(--hub-red)]"
                stroke="currentColor"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                transition={{ duration: 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black text-foreground">{completionRate}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{completedTasks.length} of {totalToday} tasks</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{pointsToday} points earned today</p>
          </div>
        </div>

        {/* Completed */}
        <div className="shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completed ({completedTasks.length})</h3>
          </div>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {completedTasks.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">No tasks completed yet</p>
            ) : (
              completedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 px-2.5 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="flex-1 text-[10px] text-muted-foreground line-through truncate">{task.title}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{formatTime12(task.dueTime)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Missed */}
        {missedYesterday.length > 0 && (
          <div className="shrink-0 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Missed Yesterday ({missedYesterday.length})</h3>
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {missedYesterday.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg bg-red-50/50 dark:bg-red-950/30 px-2.5 py-1.5">
                  <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="flex-1 text-[10px] text-muted-foreground truncate">{task.title}</span>
                  <span className="text-[9px] text-red-400 shrink-0">{formatTime12(task.dueTime)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-3.5 w-3.5 text-yellow-500" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leaderboard</h3>
          </div>
          <Leaderboard currentLocationId={currentLocationId} compact />
        </div>

        {/* Quote */}
        <div className="shrink-0 px-5 py-4">
          <MotivationalQuote />
        </div>
      </div>
    </div>
  );
}
