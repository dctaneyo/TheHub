"use client";

import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Check,
  Clock,
  Sparkles,
  SprayCan,
  ClipboardList,
  Undo2,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { useReducedMotion, ANIMATION } from "@/lib/animation-constants";

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

const SWIPE_THRESHOLD = 120; // pixels to trigger completion

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface FlyupItem {
  id: string;
  points: number;
}

export function Timeline({ tasks, onComplete, onUncomplete, currentTime }: TimelineProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncomletingId, setUncompletingId] = useState<string | null>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const [flyups, setFlyups] = useState<FlyupItem[]>([]);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const completingIdsRef = useRef<Set<string>>(new Set());
  const dragDirectionRef = useRef<Map<string, "horizontal" | "vertical" | null>>(new Map());
  const prefersReducedMotion = useReducedMotion();

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
    const [hours, minutes] = time.split(":").map(Number);
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

    const [ch, cm] = currentTime.split(":").map(Number);
    const currentMinutes = ch * 60 + cm;

    const groupData = groups.map((group) => {
      const key = group.map((t) => t.id).join("-");
      const el = groupRefs.current.get(key);
      return { minutes: timeToMinutes(group[0].dueTime), key, el };
    });

    const container = containerRef.current;
    const outer = outerRef.current;
    if (!container || !outer) return;

    let before = groupData[0];
    let after: (typeof groupData)[0] | null = null;

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

    const outerTop = outer.getBoundingClientRect().top;
    const containerScrollTop = container.scrollTop;
    const containerOffsetTop = container.getBoundingClientRect().top - outerTop;

    if (currentMinutes < groupData[0].minutes) {
      const rect = beforeEl.getBoundingClientRect();
      const pos = rect.top - outerTop + containerScrollTop;
      setIndicatorTop(Math.max(containerOffsetTop, pos));
      return;
    }

    if (after === null) {
      const rect = beforeEl.getBoundingClientRect();
      setIndicatorTop(rect.bottom - outerTop + containerScrollTop);
      return;
    }

    const afterEl = after.el;
    if (!afterEl) return;

    const beforeRect = beforeEl.getBoundingClientRect();
    const afterRect = afterEl.getBoundingClientRect();

    const beforePx = beforeRect.bottom - outerTop + containerScrollTop;
    const afterPx = afterRect.top - outerTop + containerScrollTop;

    const timeDiff = after.minutes - before.minutes;
    const elapsed = currentMinutes - before.minutes;
    const ratio = timeDiff > 0 ? Math.min(elapsed / timeDiff, 1) : 0;

    setIndicatorTop(beforePx + (afterPx - beforePx) * ratio);
  }, [buildGroups, currentTime]);

  useEffect(() => {
    const timeout = setTimeout(calculateIndicatorTop, 50);
    return () => clearTimeout(timeout);
  }, [calculateIndicatorTop, currentTime]);

  /** Gesture disambiguation: only allow horizontal swipe if initial movement is >60% horizontal */
  const handleDragStart = (taskId: string, _event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const absX = Math.abs(info.delta.x);
    const absY = Math.abs(info.delta.y);
    const total = absX + absY;
    if (total === 0) {
      dragDirectionRef.current.set(taskId, null);
      return;
    }
    const horizontalRatio = absX / total;
    dragDirectionRef.current.set(taskId, horizontalRatio >= 0.6 ? "horizontal" : "vertical");
  };

  const handleDragEnd = (taskId: string, _event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const direction = dragDirectionRef.current.get(taskId);
    if (direction === "horizontal" && info.offset.x >= SWIPE_THRESHOLD) {
      handleComplete(taskId);
    }
    dragDirectionRef.current.delete(taskId);
  };

  return (
    <div ref={outerRef} className="flex h-full flex-col relative">
      <div className="mb-4 px-1">
        <h2 className="text-lg font-bold text-foreground">Today&apos;s Tasks</h2>
      </div>

      {/* Current time marker — lives outside scroll container so it's never clipped by header */}
      {indicatorTop !== null && (
        <motion.div
          className="flex absolute left-0 right-0 z-[5] items-center pointer-events-none"
          style={{ top: indicatorTop }}
          animate={{ top: indicatorTop }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
        >
          <div className="absolute left-0 right-0 h-0.5 bg-[var(--hub-red)] opacity-40" />
          <div className="absolute left-0 flex items-center pl-2">
            <div className="rounded-full bg-[var(--hub-red)] px-2 py-1 text-xs font-medium text-white shadow-md shadow-red-200">
              {formatTime(currentTime)}
            </div>
          </div>
        </motion.div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto pr-2 scrollbar-thin overflow-x-hidden">
        <div className="relative">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
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
                      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { delay: groupIdx * ANIMATION.listStagger.delayPerItem }}
                      className="relative"
                    >
                      {/* Sticky time header */}
                      <div className="sticky top-0 z-[3] flex items-center justify-between px-2 py-1.5 bg-background/80 backdrop-blur-sm">
                        <span className="text-xs font-bold text-muted-foreground">{formatTime(group[0].dueTime)}</span>
                        <span className="text-[10px] text-muted-foreground">{group.length} task{group.length !== 1 ? 's' : ''}</span>
                      </div>

                      <div className={cn(group.length > 1 ? "flex gap-2" : "", "space-y-2")}>
                      {group.map((task) => {
                        const isCompleting = completingId === task.id;
                        const Icon = typeIcons[task.type] || ClipboardList;
                        const canSwipe = !task.isCompleted && !isCompleting;
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
                                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
                                  className="pointer-events-none absolute right-3 top-2 z-20 flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-white shadow-lg shadow-amber-200"
                                >
                                  <Sparkles className="h-3 w-3" />+{f.points} pts
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {/* Collapsed single-line view for completed tasks */}
                            {task.isCompleted && !isCompleting ? (
                              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 opacity-60">
                                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                                <span className="text-sm text-muted-foreground line-through truncate">{task.title}</span>
                                <button
                                  onClick={(e) => handleUncomplete(task.id, e)}
                                  disabled={uncomletingId === task.id}
                                  aria-label={`Undo completion: ${task.title}`}
                                  className="ml-auto shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                                >
                                  <Undo2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                            /* Task card — Frosted Glass with left-edge stripe */
                            <motion.div
                              className={cn(
                                "w-full rounded-2xl p-4 text-left relative overflow-hidden",
                                "bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg",
                              )}
                              whileTap={prefersReducedMotion ? undefined : { scale: ANIMATION.cardPress.scale }}
                              drag={canSwipe ? "x" : false}
                              dragConstraints={{ left: 0, right: 150 }}
                              dragElastic={0.1}
                              dragSnapToOrigin
                              onDragStart={canSwipe ? (_e, info) => handleDragStart(task.id, _e, info) : undefined}
                              onDragEnd={canSwipe ? (_e, info) => handleDragEnd(task.id, _e, info) : undefined}
                            >
                              {/* Left-edge color stripe */}
                              <div
                                className={cn(
                                  "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
                                  task.isOverdue && !task.isCompleted && "bg-red-500 animate-pulse",
                                  task.isDueSoon && !task.isCompleted && "bg-amber-500",
                                  task.isCompleted && "bg-emerald-500",
                                  !task.isOverdue && !task.isDueSoon && !task.isCompleted && "bg-slate-400",
                                )}
                              />

                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                    isCompleting
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : task.isOverdue
                                        ? "bg-red-500/20 text-red-400"
                                        : task.isDueSoon
                                          ? "bg-amber-500/20 text-amber-400"
                                          : "bg-white/10 text-muted-foreground",
                                  )}
                                >
                                  <Icon className="h-4.5 w-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-foreground">
                                      {task.title}
                                    </span>
                                    {task.isOverdue && !task.isCompleted && (
                                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                                        OVERDUE
                                      </span>
                                    )}
                                    {task.isDueSoon && !task.isCompleted && (
                                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                        DUE SOON
                                      </span>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                                      {task.description}
                                    </p>
                                  )}
                                  <div className="mt-1.5 flex items-center gap-3">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {formatTime(task.dueTime)}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
                                      <Sparkles className="h-3 w-3" />
                                      {task.points} pts
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                        task.type === "cleaning"
                                          ? "bg-purple-500/20 text-purple-400"
                                          : task.type === "reminder"
                                            ? "bg-sky-500/20 text-sky-400"
                                            : "bg-white/10 text-muted-foreground",
                                      )}
                                    >
                                      {task.type}
                                    </span>
                                  </div>
                                </div>

                                {/* Accessible button fallback for completion */}
                                {!isCompleting && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleComplete(task.id);
                                    }}
                                    aria-label={`Complete task: ${task.title}`}
                                    className="mt-1 shrink-0 rounded-xl bg-white/10 hover:bg-emerald-500/20 active:scale-95 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-emerald-400 shadow-sm transition-all cursor-pointer"
                                  >
                                    Tap
                                  </button>
                                )}

                                {/* Checkmark animation on completing — 400ms spring */}
                                {isCompleting && (
                                  <motion.div
                                    initial={prefersReducedMotion ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20, duration: 0.4 }}
                                    className="mt-1 shrink-0"
                                  >
                                    <Check className="h-6 w-6 text-emerald-400" />
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                            )}
                          </div>
                        );
                      })}
                      </div>
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
