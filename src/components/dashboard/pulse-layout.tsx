"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DayPhaseBackground } from "@/components/dashboard/day-phase-background";
import type { TaskItem } from "@/components/dashboard/timeline";
import { useReducedMotion } from "@/lib/animation-constants";

// ── Constants ─────────────────────────────────────────────────────

const RING_STROKE_WIDTH = 12;
const RING_PADDING = 40;
const DOT_RADIUS = 8;
const CLUSTER_DOT_RADIUS = 12;
const CLUSTER_THRESHOLD = 30;
const CLUSTER_ANGLE_PROXIMITY = 15; // degrees
const MIN_CONTAINER_SIZE = 200;

// ── Helpers ───────────────────────────────────────────────────────

/** Calculate the angle (in degrees) for a task on a 12-hour clock face. */
export function calculateTaskAngle(dueTime: string): number {
  const [h, m] = dueTime.split(":").map(Number);
  const hour12 = h % 12;
  const totalMinutes = hour12 * 60 + m;
  return (totalMinutes / 720) * 360;
}

/** Convert a clock-face angle to SVG coordinates (0° = 12 o'clock, clockwise). */
function angleToXY(angleDeg: number, cx: number, cy: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Format a time string (HH:mm) to 12-hour display. */
function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Determine the status word and color for a health score. */
function getStatusDisplay(score: number): { word: string; colorClass: string } {
  if (score >= 80) return { word: "Crushing", colorClass: "text-emerald-400" };
  if (score >= 50) return { word: "Steady", colorClass: "text-amber-400" };
  return { word: "Behind", colorClass: "text-red-400" };
}

/** Determine the worst status in a group of tasks. */
function segmentColor(tasks: TaskItem[]): string {
  if (tasks.some((t) => t.isOverdue && !t.isCompleted)) return "#ef4444"; // red
  if (tasks.every((t) => t.isCompleted)) return "#10b981"; // emerald
  return "#64748b"; // slate
}

/** Build an SVG arc path for a segment of the ring. */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = angleToXY(startAngle, cx, cy, r);
  const end = angleToXY(endAngle, cx, cy, r);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// ── Types ─────────────────────────────────────────────────────────

interface TaskDot {
  type: "single";
  task: TaskItem;
  angle: number;
}

interface ClusterDot {
  type: "cluster";
  tasks: TaskItem[];
  angle: number; // average angle
  count: number;
}

type RingDot = TaskDot | ClusterDot;

interface HourSegment {
  hour: number;
  tasks: TaskItem[];
  startAngle: number;
  endAngle: number;
}

// ── Clustering logic ──────────────────────────────────────────────

function buildRingDots(tasks: TaskItem[]): RingDot[] {
  const withAngles = tasks.map((t) => ({
    task: t,
    angle: calculateTaskAngle(t.dueTime),
  }));

  // Sort by angle for clustering
  withAngles.sort((a, b) => a.angle - b.angle);

  if (tasks.length <= CLUSTER_THRESHOLD) {
    return withAngles.map((d) => ({ type: "single" as const, task: d.task, angle: d.angle }));
  }

  // Group nearby tasks into clusters
  const dots: RingDot[] = [];
  let i = 0;
  while (i < withAngles.length) {
    const group = [withAngles[i]];
    let j = i + 1;
    while (j < withAngles.length && withAngles[j].angle - withAngles[i].angle <= CLUSTER_ANGLE_PROXIMITY) {
      group.push(withAngles[j]);
      j++;
    }
    if (group.length === 1) {
      dots.push({ type: "single", task: group[0].task, angle: group[0].angle });
    } else {
      const avgAngle = group.reduce((sum, g) => sum + g.angle, 0) / group.length;
      dots.push({
        type: "cluster",
        tasks: group.map((g) => g.task),
        angle: avgAngle,
        count: group.length,
      });
    }
    i = j;
  }
  return dots;
}

function buildHourSegments(tasks: TaskItem[]): HourSegment[] {
  const byHour = new Map<number, TaskItem[]>();
  for (const t of tasks) {
    const h = parseInt(t.dueTime.split(":")[0], 10) % 12;
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(t);
  }

  const segments: HourSegment[] = [];
  for (const [hour, hourTasks] of byHour) {
    segments.push({
      hour,
      tasks: hourTasks,
      startAngle: (hour * 60) / 720 * 360,
      endAngle: ((hour + 1) * 60) / 720 * 360,
    });
  }
  return segments.sort((a, b) => a.startAngle - b.startAngle);
}

// ── RadialWheel Component ─────────────────────────────────────────

interface RadialWheelProps {
  tasks: TaskItem[];
  currentTime: string;
  healthScore: number;
  onSelectTask: (task: TaskItem) => void;
  onSelectCluster: (tasks: TaskItem[]) => void;
}

function RadialWheel({
  tasks,
  healthScore,
  onSelectTask,
  onSelectCluster,
}: RadialWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(MIN_CONTAINER_SIZE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize(Math.max(MIN_CONTAINER_SIZE, Math.min(width, height)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - RING_PADDING;

  const segments = useMemo(() => buildHourSegments(tasks), [tasks]);
  const dots = useMemo(() => buildRingDots(tasks), [tasks]);
  const status = useMemo(() => getStatusDisplay(healthScore), [healthScore]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={`Shift progress: ${healthScore}% health, ${status.word}`}
      >
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={RING_STROKE_WIDTH}
        />

        {/* Hour segments */}
        {segments.map((seg) => (
          <path
            key={seg.hour}
            d={describeArc(cx, cy, r, seg.startAngle, seg.endAngle)}
            fill="none"
            stroke={segmentColor(seg.tasks)}
            strokeWidth={RING_STROKE_WIDTH}
            strokeLinecap="round"
            opacity={0.7}
          />
        ))}

        {/* Task dots */}
        {dots.map((dot, i) => {
          const pos = angleToXY(dot.angle, cx, cy, r);

          if (dot.type === "cluster") {
            return (
              <g key={`cluster-${i}`}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={CLUSTER_DOT_RADIUS}
                  fill="#64748b"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1.5}
                  className="cursor-pointer"
                  onClick={() => onSelectCluster(dot.tasks)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${dot.count} tasks clustered`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectCluster(dot.tasks);
                  }}
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={10}
                  fontWeight={700}
                  className="pointer-events-none select-none"
                >
                  {dot.count}
                </text>
              </g>
            );
          }

          const task = dot.task;
          const dotColor = task.isCompleted
            ? "#10b981"
            : task.isOverdue
              ? "#ef4444"
              : "#64748b";

          return (
            <circle
              key={task.id}
              cx={pos.x}
              cy={pos.y}
              r={DOT_RADIUS}
              fill={dotColor}
              stroke={task.isCompleted ? "#10b981" : "rgba(255,255,255,0.15)"}
              strokeWidth={1.5}
              className={`cursor-pointer ${task.isOverdue && !task.isCompleted ? "animate-pulse" : ""}`}
              onClick={() => onSelectTask(task)}
              role="button"
              tabIndex={0}
              aria-label={`${task.title} — ${task.isCompleted ? "completed" : task.isOverdue ? "overdue" : "pending"}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectTask(task);
              }}
            />
          );
        })}

        {/* Center health score */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={size > 300 ? 48 : 36}
          fontWeight={900}
          className="select-none"
        >
          {healthScore}
        </text>
        <text
          x={cx}
          y={cy + (size > 300 ? 28 : 22)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={status.word === "Crushing" ? "#34d399" : status.word === "Steady" ? "#fbbf24" : "#f87171"}
          fontSize={14}
          fontWeight={700}
          className="select-none"
        >
          {status.word}
        </text>
      </svg>
    </div>
  );
}

// ── TaskCardOverlay Component ─────────────────────────────────────

interface TaskCardOverlayProps {
  task: TaskItem;
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onClose: () => void;
  prefersReducedMotion: boolean;
}

function TaskCardOverlay({ task, onComplete, onUncomplete, onClose, prefersReducedMotion }: TaskCardOverlayProps) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 shadow-lg"
    >
      <h3 className="text-sm font-black text-white">{task.title}</h3>
      {task.description && (
        <p className="text-xs text-white/60 mt-1">{task.description}</p>
      )}
      <p className="text-xs text-white/40 mt-1">
        {formatTime12(task.dueTime)} · {task.points} pts
      </p>
      <div className="flex gap-2 mt-3">
        {!task.isCompleted ? (
          <button
            onClick={() => onComplete(task.id)}
            className="flex-1 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
          >
            Complete
          </button>
        ) : (
          <button
            onClick={() => onUncomplete(task.id)}
            className="flex-1 h-10 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors"
          >
            Undo
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-xl bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}

// ── ClusterListOverlay Component ──────────────────────────────────

interface ClusterListOverlayProps {
  tasks: TaskItem[];
  onSelectTask: (task: TaskItem) => void;
  onClose: () => void;
  prefersReducedMotion: boolean;
}

function ClusterListOverlay({ tasks, onSelectTask, onClose, prefersReducedMotion }: ClusterListOverlayProps) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 shadow-lg max-h-[60%] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-white">{tasks.length} Tasks</h3>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors flex items-center justify-center"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelectTask(task)}
            className="w-full text-left rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  task.isCompleted
                    ? "bg-emerald-500"
                    : task.isOverdue
                      ? "bg-red-500 animate-pulse"
                      : "bg-slate-400"
                }`}
              />
              <span className="text-xs font-medium text-white">{task.title}</span>
            </div>
            <p className="text-[10px] text-white/40 mt-1 pl-4">
              {formatTime12(task.dueTime)} · {task.points} pts
            </p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ── PulseLayout (main export) ─────────────────────────────────────

interface PulseLayoutProps {
  tasks: TaskItem[];
  currentTime: string;
  pointsToday: number;
  streak: number;
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
}

export function PulseLayout({
  tasks,
  currentTime,
  onComplete,
  onUncomplete,
}: PulseLayoutProps) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [clusterTasks, setClusterTasks] = useState<TaskItem[] | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.isOverdue && !t.isCompleted).length,
    [tasks],
  );

  const dueSoonCount = useMemo(
    () => tasks.filter((t) => t.isDueSoon && !t.isCompleted).length,
    [tasks],
  );

  const healthScore = useMemo(
    () => Math.max(0, Math.min(100, 100 - overdueCount * 15 - dueSoonCount * 5)),
    [overdueCount, dueSoonCount],
  );

  const handleSelectTask = useCallback((task: TaskItem) => {
    setClusterTasks(null);
    setSelectedTask(task);
  }, []);

  const handleSelectCluster = useCallback((tasks: TaskItem[]) => {
    setSelectedTask(null);
    setClusterTasks(tasks);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setSelectedTask(null);
    setClusterTasks(null);
  }, []);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden min-h-[200px]">
      {/* Day-phase ambient background — gentle color wash, no particles handled by parent */}
      <DayPhaseBackground />

      {/* Radial wheel centered */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <RadialWheel
          tasks={tasks}
          currentTime={currentTime}
          healthScore={healthScore}
          onSelectTask={handleSelectTask}
          onSelectCluster={handleSelectCluster}
        />
      </div>

      {/* Task card overlay (when a dot is tapped) */}
      <AnimatePresence>
        {selectedTask && (
          <TaskCardOverlay
            task={selectedTask}
            onComplete={(id) => {
              onComplete(id);
              setSelectedTask(null);
            }}
            onUncomplete={(id) => {
              onUncomplete(id);
              setSelectedTask(null);
            }}
            onClose={handleCloseOverlay}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      {/* Cluster list overlay (when a cluster dot is tapped) */}
      <AnimatePresence>
        {clusterTasks && (
          <ClusterListOverlay
            tasks={clusterTasks}
            onSelectTask={handleSelectTask}
            onClose={handleCloseOverlay}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
