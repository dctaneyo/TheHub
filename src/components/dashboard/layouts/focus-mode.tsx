"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ClipboardList,
  SprayCan,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { SeasonalTheme } from "@/components/dashboard/seasonal-theme";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import { TaskCheckmark } from "@/components/ui/success-checkmark";
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

export function FocusModeLayout({
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
  const [expandCompleted, setExpandCompleted] = useState(false);
  const [expandMissed, setExpandMissed] = useState(false);
  const [expandLeaderboard, setExpandLeaderboard] = useState(false);

  // Sort tasks: overdue first, then due-soon, then by time
  const pendingTasks = allTasks.filter((t) => !t.isCompleted);
  const sortedPending = [...pendingTasks].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.isDueSoon && !b.isDueSoon) return -1;
    if (!a.isDueSoon && b.isDueSoon) return 1;
    return a.dueTime.localeCompare(b.dueTime);
  });

  const heroTask = sortedPending[0];
  const upNext = sortedPending.slice(1, 4);
  const later = sortedPending.slice(4);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Status Bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--hub-red)] to-[#c4001f] text-white">
            <Trophy className="h-3.5 w-3.5 text-yellow-300" />
            <span className="text-sm font-black">{pointsToday}</span>
            <span className="text-[9px] text-white/60">pts</span>
          </div>

          <div className="flex-1 px-2">
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--hub-red)]"
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5 text-center">{completedTasks.length}/{totalToday} tasks</p>
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-sm font-bold text-foreground">{completionRate}%</span>
          </div>

          <SeasonalTheme showFloating={false} />
        </div>

        {/* Hero Task */}
        {heroTask ? (
          <motion.div
            key={heroTask.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-2xl border-2 p-5 shadow-lg",
              heroTask.isOverdue
                ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                : heroTask.isDueSoon
                ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                {heroTask.isOverdue && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase mb-1">
                    <AlertTriangle className="h-3 w-3" /> Overdue
                  </span>
                )}
                {heroTask.isDueSoon && !heroTask.isOverdue && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase mb-1">
                    <Clock className="h-3 w-3" /> Due Soon
                  </span>
                )}
                <h2 className="text-xl font-black text-foreground">{heroTask.title}</h2>
                {heroTask.description && (
                  <p className="text-sm text-muted-foreground mt-1">{heroTask.description}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-lg font-bold text-foreground">{formatTime12(heroTask.dueTime)}</p>
                <div className="flex items-center gap-1 justify-end">
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                  <span className="text-sm font-bold text-muted-foreground">{heroTask.points} pts</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onComplete(heroTask.id)}
              className="w-full rounded-xl bg-[var(--hub-red)] py-3.5 text-base font-bold text-white shadow-sm transition-transform active:scale-[0.98] hover:brightness-110"
            >
              ✓ Complete Task
            </button>
          </motion.div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Sparkles className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-xl font-black text-foreground">All Done!</h2>
            <p className="text-sm text-muted-foreground mt-1">You&apos;ve completed all tasks for today.</p>
          </div>
        )}

        {/* Up Next Cards */}
        {upNext.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">Up Next</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {upNext.map((task) => {
                const Icon = typeIcons[task.type] || ClipboardList;
                return (
                  <motion.button
                    key={task.id}
                    onClick={() => onComplete(task.id)}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                      task.isOverdue ? "border-red-300 dark:border-red-800" : task.isDueSoon ? "border-amber-300 dark:border-amber-800" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground">{formatTime12(task.dueTime)}</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{task.points} pts</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Later Tasks */}
        {later.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">Later</p>
            <div className="space-y-1">
              {later.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onComplete(task.id)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-[10px] font-medium text-muted-foreground w-16 shrink-0">{formatTime12(task.dueTime)}</span>
                  <span className="flex-1 text-xs font-medium text-foreground truncate">{task.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{task.points}pts</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Sections */}
        <CollapsibleSection
          title={`Completed (${completedTasks.length})`}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          open={expandCompleted}
          onToggle={() => setExpandCompleted(!expandCompleted)}
        >
          {completedTasks.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-3">No tasks completed yet</p>
          ) : (
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="flex-1 text-[10px] text-muted-foreground line-through truncate">{task.title}</span>
                  <span className="text-[9px] text-muted-foreground">{formatTime12(task.dueTime)}</span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title={`Missed Yesterday (${missedYesterday.length})`}
          icon={<XCircle className="h-3.5 w-3.5 text-red-400" />}
          open={expandMissed}
          onToggle={() => setExpandMissed(!expandMissed)}
        >
          {missedYesterday.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-3">No missed tasks - great job!</p>
          ) : (
            <div className="space-y-1">
              {missedYesterday.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg bg-red-50/50 dark:bg-red-950/30 px-3 py-1.5">
                  <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="flex-1 text-[10px] text-muted-foreground truncate">{task.title}</span>
                  <span className="text-[9px] text-red-400">{formatTime12(task.dueTime)}</span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Leaderboard"
          icon={<Trophy className="h-3.5 w-3.5 text-yellow-500" />}
          open={expandLeaderboard}
          onToggle={() => setExpandLeaderboard(!expandLeaderboard)}
        >
          <Leaderboard currentLocationId={currentLocationId} compact />
        </CollapsibleSection>

        <MotivationalQuote />
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors"
      >
        {icon}
        <span className="text-xs font-bold text-foreground flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
