"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "@/lib/icons";
import { type DayPhase, PHASE_CONFIG } from "@/lib/day-phase-context";
import type { TaskItem } from "@/components/dashboard/timeline";

interface TaskOrbsProps {
  tasks: TaskItem[];
  currentTime: string;
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  /** Optional day phase for orb glow theming */
  dayPhase?: DayPhase;
}

const TYPE_EMOJI: Record<string, string> = {
  task: "📋",
  cleaning: "🧹",
  reminder: "⏰",
};

const PRIORITY_GLOW: Record<string, string> = {
  urgent: "shadow-red-500/50",
  high: "shadow-orange-500/40",
  normal: "shadow-blue-500/30",
  low: "shadow-slate-400/20",
};

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Build an aria-label for a task orb button */
function getOrbAriaLabel(task: TaskItem): string {
  const status = task.isCompleted
    ? "completed"
    : task.isOverdue
      ? "overdue"
      : task.isDueSoon
        ? "due soon"
        : "pending";
  return `Task: ${task.title}, due at ${formatTime12(task.dueTime)}, ${status}`;
}

/** Dissolve particle — spawned when a task completes */
function DissolveParticles({ x, y, color }: { x: number; y: number; color: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        angle: (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        distance: 30 + Math.random() * 40,
        size: 3 + Math.random() * 4,
      })),
    [],
  );

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            opacity: 1,
            scale: 1,
            x: `calc(${x}% - ${p.size / 2}px)`,
            y: `calc(${y}% - ${p.size / 2}px)`,
          }}
          animate={{
            opacity: 0,
            scale: 0,
            x: `calc(${x + Math.cos(p.angle) * p.distance * 0.3}% - ${p.size / 2}px)`,
            y: `calc(${y + Math.sin(p.angle) * p.distance * 0.3}% - ${p.size / 2}px)`,
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
}

/**
 * Spatial Task Orbs — tasks exist as floating orbs in a radial layout.
 * Urgent ones drift closer to center and glow hotter. Completed ones
 * dissolve into particles that feed the points counter.
 */
export function TaskOrbs({ tasks, currentTime, onComplete, onUncomplete, dayPhase }: TaskOrbsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dissolving, setDissolving] = useState<Set<string>>(new Set());
  const [particleBursts, setParticleBursts] = useState<Array<{ id: string; x: number; y: number; color: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef<Set<string>>(new Set());

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Day-phase glow color for orb theming
  const phaseGlowColor = useMemo(() => {
    if (!dayPhase) return null;
    return PHASE_CONFIG[dayPhase].particleColor;
  }, [dayPhase]);

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const currentMinutes = useMemo(() => timeToMinutes(currentTime), [currentTime]);

  // Sort tasks by urgency — overdue first, then due-soon, then by time
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      if (a.isDueSoon !== b.isDueSoon) return a.isDueSoon ? -1 : 1;
      return timeToMinutes(a.dueTime) - timeToMinutes(b.dueTime);
    });
  }, [tasks]);

  // Calculate orb positions in a radial layout
  const orbPositions = useMemo(() => {
    const incomplete = sortedTasks.filter((t) => !t.isCompleted);
    const completed = sortedTasks.filter((t) => t.isCompleted);
    const all = [...incomplete, ...completed];

    return all.map((task, i) => {
      const total = all.length;

      // Urgency determines distance from center (closer = more urgent)
      let distance: number;
      if (task.isCompleted) {
        distance = 85; // completed tasks orbit far out
      } else if (task.isOverdue) {
        distance = 20 + Math.random() * 10; // very close to center
      } else if (task.isDueSoon) {
        distance = 35 + Math.random() * 10;
      } else {
        const minutesUntilDue = timeToMinutes(task.dueTime) - currentMinutes;
        distance = Math.min(75, 40 + minutesUntilDue * 0.15);
      }

      // Angle: spread evenly, with some organic jitter
      const baseAngle = (i / total) * Math.PI * 2 - Math.PI / 2;
      const jitter = Math.sin(i * 7.3) * 0.15;
      const angle = baseAngle + jitter;

      return {
        task,
        x: 50 + Math.cos(angle) * distance * 0.45,
        y: 50 + Math.sin(angle) * distance * 0.45,
        scale: task.isCompleted ? 0.6 : task.isOverdue ? 1.15 : task.isDueSoon ? 1.05 : 0.9,
        distance,
      };
    });
  }, [sortedTasks, currentMinutes]);

  const handleComplete = useCallback((taskId: string) => {
    if (completingRef.current.has(taskId)) return;
    completingRef.current.add(taskId);

    // Find the orb position for particle burst
    const orbPos = orbPositions.find((o) => o.task.id === taskId);
    if (orbPos) {
      const burstColor = phaseGlowColor || "#10b981";
      setParticleBursts((prev) => [...prev, { id: taskId, x: orbPos.x, y: orbPos.y, color: burstColor }]);
    }

    setDissolving((prev) => new Set(prev).add(taskId));
    onComplete(taskId);

    setTimeout(() => {
      setDissolving((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setParticleBursts((prev) => prev.filter((p) => p.id !== taskId));
      completingRef.current.delete(taskId);
    }, 1500);
  }, [onComplete, orbPositions, phaseGlowColor]);

  /** Compute orb boxShadow with optional phase glow tint */
  const getOrbShadow = useCallback(
    (task: TaskItem) => {
      if (task.isOverdue && !task.isCompleted) {
        return `0 0 20px rgba(239,68,68,0.5)${phaseGlowColor ? `, 0 0 30px ${phaseGlowColor}33` : ""}`;
      }
      if (task.isDueSoon && !task.isCompleted) {
        return `0 0 15px rgba(245,158,11,0.4)${phaseGlowColor ? `, 0 0 25px ${phaseGlowColor}33` : ""}`;
      }
      if (phaseGlowColor && !task.isCompleted) {
        return `0 0 12px ${phaseGlowColor}40`;
      }
      return undefined;
    },
    [phaseGlowColor],
  );

  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) : null;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      {/* Orbital rings (decorative) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[30, 50, 70].map((r) => (
          <div
            key={r}
            className="absolute rounded-full border border-border/30"
            style={{ width: `${r}%`, height: `${r}%` }}
          />
        ))}
      </div>

      {/* Dissolve particle bursts */}
      {particleBursts.map((burst) => (
        <DissolveParticles key={burst.id} x={burst.x} y={burst.y} color={burst.color} />
      ))}

      {/* Task orbs — limit to 30 animated orbs */}
      <AnimatePresence mode="popLayout">
        {orbPositions.slice(0, 30).map(({ task, x, y, scale }) => {
          const isDissolvingNow = dissolving.has(task.id);
          const isSelected = selectedId === task.id;
          const orbSize = Math.max(64, task.isCompleted ? 40 : task.isOverdue ? 56 : task.isDueSoon ? 50 : 44);

          return (
            <motion.button
              key={task.id}
              layout
              aria-label={getOrbAriaLabel(task)}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: isDissolvingNow ? 0 : task.isCompleted ? 0.5 : 1,
                scale: isDissolvingNow ? 0 : scale,
                x: `calc(${x}% - ${orbSize / 2}px)`,
                y: `calc(${y}% - ${orbSize / 2}px)`,
              }}
              exit={{ opacity: 0, scale: 0, transition: { duration: 0.3 } }}
              transition={{
                type: "spring",
                stiffness: prefersReducedMotion ? 300 : 100,
                damping: prefersReducedMotion ? 30 : 15,
                layout: { duration: prefersReducedMotion ? 0 : 0.8 },
              }}
              onClick={() => setSelectedId(isSelected ? null : task.id)}
              className={cn(
                "absolute rounded-full flex items-center justify-center cursor-pointer transition-shadow",
                "hover:ring-2 hover:ring-white/50",
                task.isCompleted && "opacity-40 grayscale",
                task.isOverdue && !task.isCompleted && "animate-pulse",
                PRIORITY_GLOW[task.priority] || PRIORITY_GLOW.normal,
                isSelected && "ring-2 ring-white z-20",
              )}
              style={{
                width: orbSize,
                height: orbSize,
                background: task.isCompleted
                  ? "linear-gradient(135deg, #6b7280, #9ca3af)"
                  : task.isOverdue
                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                    : task.isDueSoon
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : task.priority === "urgent"
                        ? "linear-gradient(135deg, #f97316, #ea580c)"
                        : task.priority === "high"
                          ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                          : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                boxShadow: getOrbShadow(task),
              }}
            >
              <span className="text-base select-none">
                {TYPE_EMOJI[task.type] || "📋"}
              </span>

              {/* Points badge */}
              {!task.isCompleted && task.points > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-white shadow">
                  {task.points}
                </span>
              )}

              {/* Completed checkmark */}
              {task.isCompleted && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-emerald-500/80">
                  <span className="text-white text-sm">✓</span>
                </div>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Selected task detail card */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{TYPE_EMOJI[selectedTask.type] || "📋"}</span>
                  <h3 className="text-sm font-bold text-foreground truncate">
                    {selectedTask.title}
                  </h3>
                </div>
                {selectedTask.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {selectedTask.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-medium text-muted-foreground">
                    {formatTime12(selectedTask.dueTime)}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-amber-500">
                    <Sparkles className="h-3 w-3" />
                    {selectedTask.points} pts
                  </span>
                  {selectedTask.isOverdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      OVERDUE
                    </span>
                  )}
                  {selectedTask.isDueSoon && !selectedTask.isOverdue && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      DUE SOON
                    </span>
                  )}
                </div>
              </div>

              {!selectedTask.isCompleted ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComplete(selectedTask.id);
                    setSelectedId(null);
                  }}
                  className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors"
                >
                  Complete
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUncomplete(selectedTask.id);
                    setSelectedId(null);
                  }}
                  className="shrink-0 rounded-xl bg-muted px-4 py-2 text-sm font-bold text-muted-foreground shadow hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  Undo
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
