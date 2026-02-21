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
import { useState, useRef, useEffect, useCallback } from "react";
import { TaskCheckmark } from "@/components/ui/success-checkmark";

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

// Animated color transitions for due-soon tasks
const colorTransitionColors = [
  "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", 
  "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-gray-500"
];

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface FlyupItem { id: string; points: number; }

export function Timeline({ tasks, onComplete, onUncomplete, currentTime }: TimelineProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncomletingId, setUncompletingId] = useState<string | null>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const [flyups, setFlyups] = useState<FlyupItem[]>([]);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  // Ref-based guard prevents double-tap firing onComplete twice before state updates
  const completingIdsRef = useRef<Set<string>>(new Set());

  const handleComplete = async (taskId: string) => {
    if (completingIdsRef.current.has(taskId)) return;
    completingIdsRef.current.add(taskId);
    setCompletingId(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.points > 0) {
      const flyId = `${taskId}-${Date.now()}`;
      setFlyups((prev) => [...prev, { id: flyId, points: task.points }]);
      setTimeout(() => setFlyups((prev) => prev.filter((f) => f.id !== flyId)), 1200);
    }
    await onComplete(taskId);
    setTimeout(() => {
      setCompletingId(null);
      completingIdsRef.current.delete(taskId);
    }, 1500);
  };

  const handleUncomplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUncompletingId(taskId);
    await onUncomplete(taskId);
    setUncompletingId(null);
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Build unique group keys (same as render logic below)
  const buildGroups = useCallback(() => {
    const groups: TaskItem[][] = [];
    tasks.forEach((task) => {
      const last = groups[groups.length - 1];
      if (last && last[0].dueTime === task.dueTime) {
        last.push(task);
      } else {
        groups.push([task]);
      }
    });
    return groups;
  }, [tasks]);

  const calculateIndicatorTop = useCallback(() => {
    const groups = buildGroups();
    if (groups.length === 0) return;

    const [ch, cm] = currentTime.split(':').map(Number);
    const currentMinutes = ch * 60 + cm;

    // Build an array of { minutes, groupKey, el } for each group
    const groupData = groups.map((group) => {
      const key = group.map((t) => t.id).join("-");
      const el = groupRefs.current.get(key);
      return { minutes: timeToMinutes(group[0].dueTime), key, el };
    });

    const container = containerRef.current;
    const outer = outerRef.current;
    if (!container || !outer) return;

    // Find the two groups that bracket the current time
    let before = groupData[0];
    let after: typeof groupData[0] | null = null;

    for (let i = 0; i < groupData.length; i++) {
      if (groupData[i].minutes <= currentMinutes) {
        before = groupData[i];
      } else if (after === null) {
        after = groupData[i];
        break;
      }
    }

    const beforeEl = before.el;
    if (!beforeEl) return;

    // Measure relative to the outer wrapper (not the scroll container)
    // so the indicator is positioned correctly even when scrolled
    const outerTop = outer.getBoundingClientRect().top;
    const containerScrollTop = container.scrollTop;
    const containerOffsetTop = container.getBoundingClientRect().top - outerTop;

    // Current time is before the first task — place line at top of first group
    if (currentMinutes < groupData[0].minutes) {
      const rect = beforeEl.getBoundingClientRect();
      const pos = rect.top - outerTop + containerScrollTop;
      setIndicatorTop(Math.max(containerOffsetTop, pos));
      return;
    }

    // Current time is at or past the last task — place line at bottom of last group
    if (after === null) {
      const rect = beforeEl.getBoundingClientRect();
      setIndicatorTop(rect.bottom - outerTop + containerScrollTop);
      return;
    }

    const afterEl = after.el;
    if (!afterEl) return;

    // Interpolate between before (bottom edge) and after (top edge) based on time ratio
    const beforeRect = beforeEl.getBoundingClientRect();
    const afterRect = afterEl.getBoundingClientRect();

    const beforePx = beforeRect.bottom - outerTop + containerScrollTop;
    const afterPx = afterRect.top - outerTop + containerScrollTop;

    const timeDiff = after.minutes - before.minutes;
    const elapsed = currentMinutes - before.minutes;
    const ratio = timeDiff > 0 ? Math.min(elapsed / timeDiff, 1) : 0;

    setIndicatorTop(beforePx + (afterPx - beforePx) * ratio);
  }, [buildGroups, currentTime]);

  // Recalculate whenever currentTime changes (every second from parent) or tasks change
  useEffect(() => {
    // Small delay to let DOM settle after render
    const timeout = setTimeout(calculateIndicatorTop, 50);
    return () => clearTimeout(timeout);
  }, [calculateIndicatorTop, currentTime]);

  return (
    <div ref={outerRef} className="flex h-full flex-col relative">
      <div className="mb-4 px-1">
        <h2 className="text-lg font-bold text-slate-800">Today&apos;s Tasks</h2>
      </div>

      {/* Current time marker — lives outside scroll container so it's never clipped by header */}
      {indicatorTop !== null && (
        <motion.div
          className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
          style={{ top: indicatorTop }}
          animate={{ top: indicatorTop }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        >
          <div className="absolute left-0 right-0 h-0.5 bg-[var(--hub-red)] opacity-40" />
          <div className="absolute left-0 flex items-center pl-8">
            <div className="rounded-full bg-[var(--hub-red)] px-2 py-1 text-xs font-medium text-white shadow-md shadow-red-200">
              {formatTime(currentTime)}
            </div>
          </div>
        </motion.div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto pr-2 scrollbar-thin overflow-x-hidden">
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-slate-200" />

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {/* Group tasks by dueTime, render same-time tasks side-by-side */}
              {(() => {
                const groups = buildGroups();
                let globalIdx = 0;
                return groups.map((group) => {
                  const groupIdx = globalIdx;
                  const groupKey = group.map((t) => t.id).join("-");
                  globalIdx += group.length;
                  return (
                    <motion.div
                      key={groupKey}
                      ref={(el) => {
                        if (el) groupRefs.current.set(groupKey, el);
                        else groupRefs.current.delete(groupKey);
                      }}
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
                            {/* Points flyup */}
                            <AnimatePresence>
                              {flyups.filter((f) => f.id.startsWith(task.id)).map((f) => (
                                <motion.div
                                  key={f.id}
                                  initial={{ opacity: 1, y: 0, scale: 1 }}
                                  animate={{ opacity: 0, y: -48, scale: 1.2 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 1.0, ease: "easeOut" }}
                                  className="pointer-events-none absolute right-3 top-2 z-20 flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-white shadow-lg shadow-amber-200"
                                >
                                  <Sparkles className="h-3 w-3" />+{f.points} pts
                                </motion.div>
                              ))}
                            </AnimatePresence>
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
                              whileTap={!task.isCompleted && !isCompleting ? { scale: 0.98 } : {}}
                              onClick={() => {
                                if (!task.isCompleted && !isCompleting) {
                                  handleComplete(task.id);
                                }
                              }}
                              className={cn(
                                "w-full rounded-2xl border-2 p-4 text-left transition-all",
                                task.isCompleted || isCompleting
                                  ? "border-emerald-200 bg-emerald-50/50 opacity-60"
                                  : task.isOverdue
                                  ? "border-red-300 bg-red-50 shadow-sm shadow-red-100 cursor-pointer"
                                  : task.isDueSoon
                                  ? "border-amber-300 shadow-sm cursor-pointer"
                                  : cn(colors.border, colors.bg, "shadow-sm hover:shadow-md cursor-pointer")
                              )}
                              animate={task.isDueSoon && !task.isCompleted ? {
                                backgroundColor: colorTransitionColors,
                                transition: { duration: 3, repeat: Infinity, ease: "linear" }
                              } : {}}
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
