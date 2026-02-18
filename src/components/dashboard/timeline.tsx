"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Sparkles,
  SprayCan,
  ClipboardList,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueTime: string;
  points: number;
  isCompleted: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
}

interface TimelineProps {
  tasks: TaskItem[];
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  currentTime: string;
}

const typeIcons: Record<string, typeof Clock> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
};

const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
  urgent: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  high: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700" },
  normal: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  low: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-600" },
};

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function Timeline({ tasks, onComplete, onUncomplete, currentTime }: TimelineProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncomletingId, setUncompletingId] = useState<string | null>(null);

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId);
    await onComplete(taskId);
    setTimeout(() => setCompletingId(null), 1500);
  };

  const handleUncomplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUncompletingId(taskId);
    await onUncomplete(taskId);
    setUncompletingId(null);
  };

  // Find the index of the current/next task based on time
  const currentIdx = tasks.findIndex(
    (t) => !t.isCompleted && t.dueTime >= currentTime
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-slate-800">Today&apos;s Tasks</h2>
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
          <Clock className="h-3.5 w-3.5 text-[var(--hub-red)]" />
          <span className="text-sm font-semibold text-slate-700">{formatTime(currentTime)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-slate-200" />

          {/* Current time marker */}
          {currentIdx >= 0 && (
            <motion.div
              className="absolute left-0 z-10 flex items-center"
              style={{ top: `${currentIdx * 100}px` }}
              initial={false}
              animate={{ top: `${currentIdx * 100}px` }}
              transition={{ type: "spring", stiffness: 100 }}
            >
              <div className="h-3 w-3 rounded-full bg-[var(--hub-red)] shadow-md shadow-red-200" />
              <div className="ml-[-1px] h-0.5 w-6 bg-[var(--hub-red)]" />
            </motion.div>
          )}

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {/* Group tasks by dueTime, render same-time tasks side-by-side */}
              {(() => {
                const groups: TaskItem[][] = [];
                tasks.forEach((task) => {
                  const last = groups[groups.length - 1];
                  if (last && last[0].dueTime === task.dueTime) {
                    last.push(task);
                  } else {
                    groups.push([task]);
                  }
                });
                let globalIdx = 0;
                return groups.map((group) => {
                  const groupIdx = globalIdx;
                  globalIdx += group.length;
                  return (
                    <motion.div
                      key={group.map((t) => t.id).join("-")}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: groupIdx * 0.04 }}
                      className={cn("relative", group.length > 1 ? "flex gap-2" : "")}
                    >
                      {group.map((task) => {
                        const isCompleting = completingId === task.id;
                        const Icon = typeIcons[task.type] || ClipboardList;
                        const colors = priorityColors[task.priority] || priorityColors.normal;
                        const isPast = task.dueTime < currentTime;
                        return (
                          <div key={task.id} className={cn("relative", group.length > 1 ? "flex-1 min-w-0" : "")}>
                            {/* Timeline dot — only show on first card in group */}
                            {group.indexOf(task) === 0 && (
                              <div className="absolute -left-8 top-4">
                                {task.isCompleted || isCompleting ? (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                                    <CheckCircle2 className="h-[18px] w-[18px] text-[var(--hub-green)]" />
                                  </motion.div>
                                ) : task.isOverdue ? (
                                  <AlertTriangle className="h-[18px] w-[18px] text-[var(--hub-red)]" />
                                ) : (
                                  <Circle className={cn("h-[18px] w-[18px]", isPast ? "text-slate-300" : "text-slate-400")} />
                                )}
                              </div>
                            )}

                            {/* Task card */}
                            <motion.div
                              onClick={() => !task.isCompleted && !isCompleting && handleComplete(task.id)}
                              whileTap={!task.isCompleted && !isCompleting ? { scale: 0.98 } : {}}
                              className={cn(
                                "w-full rounded-2xl border-2 p-4 text-left transition-all",
                                task.isCompleted || isCompleting
                                  ? "border-emerald-200 bg-emerald-50/50 opacity-60"
                                  : task.isOverdue
                                  ? "border-red-300 bg-red-50 shadow-sm shadow-red-100 cursor-pointer"
                                  : task.isDueSoon
                                  ? "border-amber-300 bg-amber-50 shadow-sm shadow-amber-100 animate-pulse cursor-pointer"
                                  : cn(colors.border, colors.bg, "shadow-sm hover:shadow-md cursor-pointer")
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                  task.isCompleted || isCompleting ? "bg-emerald-100 text-emerald-600"
                                    : task.isOverdue ? "bg-red-100 text-red-600"
                                    : task.isDueSoon ? "bg-amber-100 text-amber-600"
                                    : `${colors.bg} ${colors.text}`
                                )}>
                                  <Icon className="h-4.5 w-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn("text-sm font-semibold", task.isCompleted ? "line-through text-slate-400" : "text-slate-800")}>
                                      {task.title}
                                    </span>
                                    {task.isOverdue && !task.isCompleted && (
                                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">OVERDUE</span>
                                    )}
                                    {task.isDueSoon && !task.isCompleted && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">DUE SOON</span>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{task.description}</p>
                                  )}
                                  <div className="mt-1.5 flex items-center gap-3">
                                    <span className="text-xs font-medium text-slate-500">{formatTime(task.dueTime)}</span>
                                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                      <Sparkles className="h-3 w-3" />{task.points} pts
                                    </span>
                                    <span className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                      task.type === "cleaning" ? "bg-purple-100 text-purple-600"
                                        : task.type === "reminder" ? "bg-sky-100 text-sky-600"
                                        : "bg-slate-100 text-slate-600"
                                    )}>{task.type}</span>
                                  </div>
                                </div>
                                {!task.isCompleted && !isCompleting && (
                                  <div className="mt-1 shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
                                    Tap
                                  </div>
                                )}
                                {isCompleting && (
                                  <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="mt-1 shrink-0">
                                    <Sparkles className="h-6 w-6 text-amber-500" />
                                  </motion.div>
                                )}
                                {task.isCompleted && !isCompleting && (
                                  <button
                                    onClick={(e) => handleUncomplete(task.id, e)}
                                    disabled={uncomletingId === task.id}
                                    className="mt-1 shrink-0 flex items-center gap-1 rounded-xl bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                                  >
                                    <Undo2 className="h-3 w-3" />Undo
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                    </motion.div>
                  );
                });
              })()}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
