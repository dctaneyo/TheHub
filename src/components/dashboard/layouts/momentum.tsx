"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Trophy,
  Flame,
  ClipboardList,
  SprayCan,
  XCircle,
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

// Time-of-day gradient backgrounds
function getTimeGradient(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return "from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/30"; // sunrise
  if (h >= 8 && h < 12) return "from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-indigo-950/20"; // morning
  if (h >= 12 && h < 16) return "from-cyan-50 via-sky-50 to-blue-50 dark:from-cyan-950/20 dark:via-sky-950/20 dark:to-blue-950/20"; // afternoon
  if (h >= 16 && h < 19) return "from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-yellow-950/20"; // golden hour
  if (h >= 19 && h < 21) return "from-violet-100 via-purple-50 to-indigo-100 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-indigo-950/30"; // sunset
  return "from-slate-900 via-indigo-950 to-slate-950 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900"; // night
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
  currentLocationId,
  onComplete,
}: DashboardLayoutProps) {
  const completionRate = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const pendingTasks = useMemo(
    () => allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime)),
    [allTasks]
  );
  const nextTask = pendingTasks[0];
  const gradient = getTimeGradient();
  const greeting = getGreeting();
  const isNight = new Date().getHours() >= 21 || new Date().getHours() < 5;

  return (
    <div className={cn("flex-1 overflow-y-auto bg-gradient-to-br", gradient, "relative")}>
      {/* Decorative orbs */}
      <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-white/20 dark:bg-white/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-[15%] w-64 h-64 rounded-full bg-white/15 dark:bg-white/3 blur-[60px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        {/* Greeting + Focus Area */}
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("text-lg font-medium mb-1", isNight ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}
          >
            {greeting}
          </motion.p>

          {/* Main focus: next task or all-done */}
          {nextTask ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className={cn("text-xs font-semibold uppercase tracking-[0.2em] mb-2",
                nextTask.isOverdue ? "text-red-500" : nextTask.isDueSoon ? "text-amber-500" : isNight ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
              )}>
                {nextTask.isOverdue ? "Overdue" : nextTask.isDueSoon ? "Due soon" : "Focus on"}
              </p>
              <h1 className={cn("text-4xl md:text-5xl font-black tracking-tight leading-tight", isNight ? "text-white" : "text-slate-900 dark:text-white")}>
                {nextTask.title}
              </h1>
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className={cn("text-base font-medium", isNight ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                  {formatTime12(nextTask.dueTime)}
                </span>
                <span className={cn("text-sm", isNight ? "text-slate-600" : "text-slate-300 dark:text-slate-600")}>·</span>
                <span className={cn("text-base font-medium flex items-center gap-1", isNight ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> {nextTask.points} pts
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onComplete(nextTask.id)}
                className="mt-6 inline-flex items-center gap-2.5 rounded-2xl bg-[var(--hub-red)] px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-red-200/30 dark:shadow-red-950/30 hover:brightness-110 transition-all"
              >
                <CheckCircle2 className="h-5 w-5" /> Complete
              </motion.button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Sparkles className="h-16 w-16 text-amber-400 mx-auto mb-4" />
              <h1 className={cn("text-4xl md:text-5xl font-black tracking-tight", isNight ? "text-white" : "text-slate-900 dark:text-white")}>
                All clear.
              </h1>
              <p className={cn("text-lg mt-2", isNight ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                Every task is done. {pointsToday} points earned today.
              </p>
            </motion.div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn("rounded-2xl p-4 backdrop-blur-md border shadow-sm text-center",
              isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30"
            )}
          >
            <Trophy className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <motion.p key={pointsToday} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={cn("text-2xl font-black", isNight ? "text-white" : "text-slate-900 dark:text-white")}>
              {pointsToday}
            </motion.p>
            <p className={cn("text-[10px] font-medium uppercase tracking-wider", isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>Points</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={cn("rounded-2xl p-4 backdrop-blur-md border shadow-sm text-center",
              isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30"
            )}
          >
            <Flame className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <p className={cn("text-2xl font-black", isNight ? "text-white" : "text-slate-900 dark:text-white")}>{completionRate}%</p>
            <p className={cn("text-[10px] font-medium uppercase tracking-wider", isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>Complete</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn("rounded-2xl p-4 backdrop-blur-md border shadow-sm text-center",
              isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30"
            )}
          >
            <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
            <p className={cn("text-2xl font-black", isNight ? "text-white" : "text-slate-900 dark:text-white")}>{completedTasks.length}/{totalToday}</p>
            <p className={cn("text-[10px] font-medium uppercase tracking-wider", isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>Tasks</p>
          </motion.div>
        </div>

        {/* Two columns: remaining tasks + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Remaining tasks */}
          <div className="lg:col-span-3">
            {pendingTasks.length > 1 && (
              <>
                <p className={cn("text-[10px] font-bold uppercase tracking-[0.15em] mb-3 px-1",
                  isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500"
                )}>
                  Coming up ({pendingTasks.length - 1} more)
                </p>
                <div className="space-y-2">
                  {pendingTasks.slice(1).map((task, i) => {
                    const Icon = typeIcons[task.type] || ClipboardList;
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + i * 0.04 }}
                        onClick={() => onComplete(task.id)}
                        className={cn(
                          "group flex items-center gap-3.5 rounded-2xl px-4 py-3 cursor-pointer transition-all backdrop-blur-md border shadow-sm",
                          task.isOverdue
                            ? isNight ? "bg-red-950/20 border-red-800/30 hover:bg-red-950/30" : "bg-red-50/60 border-red-200/50 hover:bg-red-50"
                            : task.isDueSoon
                            ? isNight ? "bg-amber-950/20 border-amber-800/30 hover:bg-amber-950/30" : "bg-amber-50/40 border-amber-200/50 hover:bg-amber-50"
                            : isNight ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white/50 dark:bg-slate-800/30 border-white/40 dark:border-slate-700/30 hover:bg-white/70 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          task.isOverdue ? "bg-red-100 dark:bg-red-900/30" : task.isDueSoon ? "bg-amber-100 dark:bg-amber-900/30" : "bg-slate-100 dark:bg-slate-700/40"
                        )}>
                          <Icon className={cn("h-4 w-4",
                            task.isOverdue ? "text-red-500" : task.isDueSoon ? "text-amber-500" : "text-slate-400 dark:text-slate-500"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-semibold truncate", isNight ? "text-white" : "text-slate-900 dark:text-white")}>{task.title}</p>
                          <p className={cn("text-[10px] mt-0.5", isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>
                            {formatTime12(task.dueTime)} · {task.points} pts
                          </p>
                        </div>
                        <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)] text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-lg">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <div className="mt-6">
                <p className={cn("text-[10px] font-bold uppercase tracking-[0.15em] mb-3 px-1",
                  isNight ? "text-slate-500" : "text-slate-400 dark:text-slate-500"
                )}>
                  Completed ({completedTasks.length})
                </p>
                <div className="space-y-1">
                  {completedTasks.map((task) => (
                    <div key={task.id} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2",
                      isNight ? "bg-emerald-950/10" : "bg-emerald-50/40 dark:bg-emerald-950/10"
                    )}>
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className={cn("flex-1 text-[11px] line-through truncate", isNight ? "text-slate-600" : "text-slate-400 dark:text-slate-600")}>{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            {/* Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn("rounded-2xl p-4 backdrop-blur-md border shadow-sm",
                isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className={cn("text-xs font-bold uppercase tracking-wider", isNight ? "text-slate-300" : "text-slate-900 dark:text-white")}>Leaderboard</span>
              </div>
              <Leaderboard currentLocationId={currentLocationId} compact />
            </motion.div>

            {/* Missed */}
            {missedYesterday.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className={cn("rounded-2xl p-4 backdrop-blur-md border shadow-sm",
                  isNight ? "bg-red-950/10 border-red-800/20" : "bg-white/60 dark:bg-slate-800/40 border-red-100 dark:border-red-900/20"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span className={cn("text-xs font-bold uppercase tracking-wider", isNight ? "text-slate-300" : "text-slate-900 dark:text-white")}>Missed Yesterday</span>
                </div>
                <div className="space-y-1">
                  {missedYesterday.map((task) => (
                    <div key={task.id} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5", isNight ? "bg-red-950/20" : "bg-red-50/40 dark:bg-red-950/10")}>
                      <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                      <span className={cn("flex-1 text-[10px] truncate", isNight ? "text-slate-500" : "text-slate-500")}>{task.title}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Quote */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn("rounded-2xl p-4 backdrop-blur-md border shadow-sm",
                isNight ? "bg-white/5 border-white/10" : "bg-white/60 dark:bg-slate-800/40 border-white/40 dark:border-slate-700/30"
              )}
            >
              <MotivationalQuote />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
