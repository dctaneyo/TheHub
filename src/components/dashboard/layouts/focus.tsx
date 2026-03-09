"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  ClipboardList,
  SprayCan,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import type { DashboardLayoutProps } from "./layout-props";

/*
 * FOCUS MODE — 2-column layout (original 3-col with right column removed)
 *
 * Left sidebar (~250px):
 *   Collapsible accordions: Completed, Missed, Leaderboard
 *   Progress stats at top
 *
 * Main area (fills remaining width):
 *   Single scrollable column:
 *     1. Hero card for current/next task with large "Complete" button
 *     2. Up-next cards in a responsive grid (next ~3 tasks)
 *     3. Later tasks in a compact list
 */

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

const priorityBorder: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  normal: "border-l-blue-500",
  low: "border-l-slate-300 dark:border-l-slate-600",
};

function Accordion({ title, icon: Icon, iconColor, count, defaultOpen, children }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border-b border-slate-200/60 dark:border-slate-700/40 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-slate-400">{count}</span>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 max-h-[200px] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FocusLayout({
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
  const circ = 2 * Math.PI * 34;
  const dash = (pct / 100) * circ;

  const incompleteTasks = useMemo(
    () => allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime)),
    [allTasks]
  );

  const heroTask = incompleteTasks[0] ?? null;
  const upNextTasks = incompleteTasks.slice(1, 4);
  const laterTasks = incompleteTasks.slice(4);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ═══ LEFT SIDEBAR: Collapsible Accordions ═══ */}
      <div className="w-[260px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
        {/* Progress stats */}
        <div className="shrink-0 p-4 border-b border-slate-200/60 dark:border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 76 76">
                <circle cx="38" cy="38" r="34" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-slate-700" />
                <motion.circle cx="38" cy="38" r="34" fill="none" strokeWidth="4" strokeLinecap="round"
                  className={pct === 100 ? "text-emerald-500" : "text-[var(--hub-red)]"}
                  initial={{ strokeDasharray: `0 ${circ}` }}
                  animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
                  transition={{ duration: 0.8 }}
                  stroke="currentColor"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 dark:text-white">{pct}%</span>
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 dark:text-white">{completedTasks.length}/{totalToday}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">Tasks done</p>
              <div className="flex items-center gap-1 mt-1">
                <Trophy className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{pointsToday} pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accordions */}
        <div className="flex-1 overflow-y-auto">
          <Accordion title="Completed" icon={CheckCircle2} iconColor="text-emerald-500" count={completedTasks.length} defaultOpen={true}>
            {completedTasks.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-3">Nothing yet — get started!</p>
            ) : (
              <div className="space-y-1">
                {completedTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 line-through truncate">{t.title}</span>
                    <span className="text-[8px] text-slate-400 shrink-0">{formatTime12(t.dueTime)}</span>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          <Accordion title="Missed Yesterday" icon={XCircle} iconColor="text-red-400" count={missedYesterday.length}>
            {missedYesterday.length === 0 ? (
              <p className="text-[10px] text-emerald-500 text-center py-3">None — great job!</p>
            ) : (
              <div className="space-y-1">
                {missedYesterday.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-red-50/60 dark:bg-red-950/20 px-2.5 py-1.5">
                    <XCircle className="h-3 w-3 text-red-300 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          <Accordion title="Leaderboard" icon={Trophy} iconColor="text-amber-500">
            <Leaderboard currentLocationId={currentLocationId} compact />
          </Accordion>
        </div>
      </div>

      {/* ═══ MAIN AREA: Scrollable focus column ═══ */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 space-y-6">

          {/* ── Hero Card: Current/Next Task ── */}
          {heroTask ? (
            <motion.div
              key={heroTask.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative rounded-3xl border-2 p-6 shadow-lg overflow-hidden",
                heroTask.isOverdue
                  ? "border-red-300 dark:border-red-700 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-900"
                  : heroTask.isDueSoon
                    ? "border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              )}
            >
              {heroTask.isOverdue && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">Overdue</div>
              )}
              {heroTask.isDueSoon && !heroTask.isOverdue && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">Due Soon</div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-1",
                    heroTask.isOverdue ? "text-red-500" : heroTask.isDueSoon ? "text-amber-500" : "text-slate-400"
                  )}>
                    {heroTask.isOverdue ? "Overdue" : heroTask.isDueSoon ? "Due soon" : "Up next"} · {formatTime12(heroTask.dueTime)}
                  </p>
                  <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-2">{heroTask.title}</h1>
                  {heroTask.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{heroTask.description}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      {(() => { const Icon = typeIcons[heroTask.type] || Clock; return <Icon className="h-3.5 w-3.5" />; })()}
                      <span className="capitalize">{heroTask.type}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 capitalize">{heroTask.priority}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
                      <Sparkles className="h-3.5 w-3.5" /> {heroTask.points} pts
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onComplete(heroTask.id)}
                  className="shrink-0 flex items-center gap-2 rounded-2xl bg-[var(--hub-red)] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-red-200/30 dark:shadow-red-950/30 hover:brightness-110 transition-all"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Complete
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-8 text-center"
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">All Clear!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Every task is done. {pointsToday} points earned today.</p>
            </motion.div>
          )}

          {/* ── Up Next: Card Grid ── */}
          {upNextTasks.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Up Next</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {upNextTasks.map((task, i) => {
                  const Icon = typeIcons[task.type] || Clock;
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm border-l-4 flex flex-col gap-2",
                        priorityBorder[task.priority] || "border-l-slate-300",
                        task.isOverdue && "border-red-200 dark:border-red-800/40",
                        task.isDueSoon && !task.isOverdue && "border-amber-200 dark:border-amber-800/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider",
                          task.isOverdue ? "text-red-500" : task.isDueSoon ? "text-amber-500" : "text-slate-400"
                        )}>
                          {formatTime12(task.dueTime)}
                        </span>
                        <span className="flex items-center gap-0.5 text-[9px] text-amber-500 font-medium">
                          <Sparkles className="h-2.5 w-2.5" /> {task.points}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{task.title}</p>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 capitalize">
                          <Icon className="h-3 w-3" /> {task.type}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onComplete(task.id)}
                          className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--hub-red)] hover:text-white transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Later Tasks: Compact List ── */}
          {laterTasks.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Later</h3>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {laterTasks.map((task) => {
                  const Icon = typeIcons[task.type] || Clock;
                  return (
                    <div key={task.id} className={cn(
                      "flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors",
                      task.isOverdue && "bg-red-50/30 dark:bg-red-950/10"
                    )}>
                      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className={cn(
                        "text-[10px] font-mono font-bold shrink-0 w-16",
                        task.isOverdue ? "text-red-500" : task.isDueSoon ? "text-amber-500" : "text-slate-400"
                      )}>
                        {formatTime12(task.dueTime)}
                      </span>
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                      <span className="text-[9px] text-amber-500 font-medium shrink-0">{task.points} pts</span>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onComplete(task.id)}
                        className="shrink-0 flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:bg-[var(--hub-red)] hover:text-white transition-colors"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" /> Done
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
