"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Zap,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Leaderboard } from "@/components/dashboard/leaderboard";
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

// Animated scan line effect
function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent pointer-events-none"
      initial={{ top: "0%" }}
      animate={{ top: "100%" }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Glowing arc gauge
function ArcGauge({ value, max, color, size = 100 }: { value: number; max: number; color: string; size?: number }) {
  const pct = max > 0 ? value / max : 0;
  const r = (size - 12) / 2;
  const circ = Math.PI * r; // half-circle
  const dash = pct * circ;

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`} className="overflow-visible">
      {/* Glow filter */}
      <defs>
        <filter id={`glow-${color}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Track */}
      <path
        d={`M 6 ${size / 2 + 4} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2 + 4}`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Value */}
      <motion.path
        d={`M 6 ${size / 2 + 4} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2 + 4}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        filter={`url(#glow-${color})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

export function NightshiftLayout({
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
  const pendingTasks = allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  const overdueCount = pendingTasks.filter((t) => t.isOverdue).length;

  // Pulse animation for overdue
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (overdueCount === 0) return;
    const t = setInterval(() => setPulse((v) => !v), 1200);
    return () => clearInterval(t);
  }, [overdueCount]);

  return (
    <div className="flex-1 overflow-hidden bg-[#0a0e1a] text-white relative flex flex-col">
      {/* Subtle scan line */}
      <ScanLine />

      {/* Grid noise overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: "40px 40px",
      }} />

      {/* Top HUD strip */}
      <div className="shrink-0 border-b border-cyan-900/30 bg-[#0d1220]/80 backdrop-blur-xl px-6 py-3 relative">
        <div className="flex items-center gap-6">
          {/* Arc gauges */}
          <div className="flex items-end gap-6">
            <div className="flex flex-col items-center">
              <ArcGauge value={completedTasks.length} max={totalToday} color="#06b6d4" size={100} />
              <div className="text-center -mt-1">
                <p className="text-2xl font-black font-mono tabular-nums text-cyan-400" style={{ textShadow: "0 0 12px rgba(6,182,212,0.4)" }}>
                  {completionRate}%
                </p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-600">Progress</p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <ArcGauge value={pointsToday} max={Math.max(pointsToday, 100)} color="#f59e0b" size={80} />
              <div className="text-center -mt-1">
                <p className="text-xl font-black font-mono tabular-nums text-amber-400" style={{ textShadow: "0 0 12px rgba(245,158,11,0.4)" }}>
                  {pointsToday}
                </p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-amber-600">Points</p>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex-1 flex items-center gap-4 ml-4">
            <div className="flex items-center gap-2 rounded-lg border border-cyan-800/30 bg-cyan-950/20 px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
              <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider">{completedTasks.length}/{totalToday} Done</span>
            </div>
            {overdueCount > 0 && (
              <motion.div
                animate={{ opacity: pulse ? 1 : 0.6 }}
                className="flex items-center gap-2 rounded-lg border border-red-800/30 bg-red-950/20 px-3 py-1.5"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">{overdueCount} Overdue</span>
              </motion.div>
            )}
            {completionRate === 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-3 py-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Mission Complete</span>
              </motion.div>
            )}
          </div>

          {/* Leaderboard mini */}
          <div className="hidden lg:block w-[200px] shrink-0">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-mono mb-1">Rankings</p>
            <Leaderboard currentLocationId={currentLocationId} compact />
          </div>
        </div>
      </div>

      {/* Main content: 2 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tasks column */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-4 w-4 text-cyan-400" style={{ filter: "drop-shadow(0 0 4px rgba(6,182,212,0.5))" }} />
            <h2 className="text-xs font-mono font-bold uppercase tracking-[0.25em] text-cyan-400/60">Active Objectives</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-cyan-800/30 to-transparent" />
          </div>

          <div className="space-y-2">
            {pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <Sparkles className="h-12 w-12 mb-3 text-cyan-500" style={{ filter: "drop-shadow(0 0 12px rgba(6,182,212,0.4))" }} />
                <p className="font-mono font-bold text-cyan-400 text-lg" style={{ textShadow: "0 0 12px rgba(6,182,212,0.3)" }}>ALL CLEAR</p>
                <p className="text-xs font-mono text-slate-600 mt-1">No pending objectives</p>
              </div>
            ) : (
              pendingTasks.map((task, i) => {
                const Icon = typeIcons[task.type] || ClipboardList;
                const isFirst = i === 0;
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.03 }}
                    onClick={() => onComplete(task.id)}
                    className={cn(
                      "group flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-all relative overflow-hidden",
                      isFirst
                        ? "border-cyan-700/40 bg-cyan-950/20 hover:bg-cyan-950/30 shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                        : task.isOverdue
                        ? "border-red-800/30 bg-red-950/10 hover:bg-red-950/20"
                        : task.isDueSoon
                        ? "border-amber-800/30 bg-amber-950/10 hover:bg-amber-950/20"
                        : "border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/50"
                    )}
                  >
                    {isFirst && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 to-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                    )}
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                      task.isOverdue ? "border-red-700/30 bg-red-950/30" : task.isDueSoon ? "border-amber-700/30 bg-amber-950/30" : "border-slate-700/30 bg-slate-800/50"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        task.isOverdue ? "text-red-400" : task.isDueSoon ? "text-amber-400" : "text-slate-500"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {task.isOverdue && <span className="text-[8px] font-mono font-bold text-red-400 bg-red-950/40 border border-red-800/30 px-1.5 py-0.5 rounded">OVERDUE</span>}
                        {task.isDueSoon && !task.isOverdue && <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-800/30 px-1.5 py-0.5 rounded">DUE SOON</span>}
                        {isFirst && !task.isOverdue && !task.isDueSoon && <span className="text-[8px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-1.5 py-0.5 rounded">NEXT UP</span>}
                      </div>
                      <p className={cn("text-sm font-semibold truncate mt-0.5", isFirst ? "text-white" : "text-slate-300")}>{task.title}</p>
                      <p className="text-[10px] font-mono text-slate-600 mt-0.5">{formatTime12(task.dueTime)} · {task.points}pts · {task.priority}</p>
                    </div>
                    <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-700/40 bg-cyan-950/30 text-cyan-400 opacity-0 group-hover:opacity-100 transition-all">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right sidebar: Completed + Missed */}
        <div className="w-[260px] shrink-0 border-l border-slate-800/50 bg-[#0b0f1c]/60 overflow-y-auto px-4 py-4 hidden lg:block">
          {/* Completed */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-500/60">Completed</span>
              <span className="ml-auto text-[10px] font-mono text-slate-600">{completedTasks.length}</span>
            </div>
            <div className="space-y-1">
              {completedTasks.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-700 text-center py-3">—</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg bg-emerald-950/10 border border-emerald-900/20 px-2.5 py-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="flex-1 text-[10px] font-mono text-slate-600 line-through truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missed */}
          {missedYesterday.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-red-500/60">Missed</span>
                <span className="ml-auto text-[10px] font-mono text-slate-600">{missedYesterday.length}</span>
              </div>
              <div className="space-y-1">
                {missedYesterday.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg bg-red-950/10 border border-red-900/20 px-2.5 py-1.5">
                    <XCircle className="h-3 w-3 text-red-700 shrink-0" />
                    <span className="flex-1 text-[10px] font-mono text-slate-600 truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
