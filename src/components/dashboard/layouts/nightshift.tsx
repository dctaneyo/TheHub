"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { CompletedMissed } from "@/components/dashboard/completed-missed";
import type { TaskItem } from "@/components/dashboard/timeline";
import type { DashboardLayoutProps } from "./layout-props";

// Animated scan line effect
function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent pointer-events-none z-10"
      initial={{ top: "0%" }}
      animate={{ top: "100%" }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Glowing arc gauge
function ArcGauge({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
  const pct = max > 0 ? value / max : 0;
  const r = (size - 10) / 2;
  const circ = Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} className="overflow-visible">
      <defs>
        <filter id={`glow-${color.replace("#", "")}`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path d={`M 5 ${size / 2 + 3} A ${r} ${r} 0 0 1 ${size - 5} ${size / 2 + 3}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round" />
      <motion.path d={`M 5 ${size / 2 + 3} A ${r} ${r} 0 0 1 ${size - 5} ${size / 2 + 3}`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" filter={`url(#glow-${color.replace("#", "")})`}
        initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${dash} ${circ - dash}` }} transition={{ duration: 1.2, ease: "easeOut" }}
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
  upcomingTasks,
  currentLocationId,
  onComplete,
  onUncomplete,
  onEarlyComplete,
}: DashboardLayoutProps) {
  const completionRate = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const overdueCount = allTasks.filter((t) => !t.isCompleted && t.isOverdue).length;

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (overdueCount === 0) return;
    const t = setInterval(() => setPulse((v) => !v), 1200);
    return () => clearInterval(t);
  }, [overdueCount]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e1a] text-white relative">
      <ScanLine />
      {/* Grid noise */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: "40px 40px",
      }} />

      {/* Top HUD strip — fixed */}
      <div className="shrink-0 border-b border-cyan-900/30 bg-[#0d1220]/80 backdrop-blur-xl px-5 py-2 relative z-20">
        <div className="flex items-center gap-5">
          {/* Arc gauges */}
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center">
              <ArcGauge value={completedTasks.length} max={totalToday} color="#06b6d4" size={80} />
              <div className="text-center -mt-0.5">
                <p className="text-lg font-black font-mono tabular-nums text-cyan-400" style={{ textShadow: "0 0 12px rgba(6,182,212,0.4)" }}>{completionRate}%</p>
                <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-700">Progress</p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <ArcGauge value={pointsToday} max={Math.max(pointsToday, 100)} color="#f59e0b" size={70} />
              <div className="text-center -mt-0.5">
                <p className="text-base font-black font-mono tabular-nums text-amber-400" style={{ textShadow: "0 0 12px rgba(245,158,11,0.4)" }}>{pointsToday}</p>
                <p className="text-[8px] uppercase tracking-[0.2em] text-amber-700">Points</p>
              </div>
            </div>
          </div>

          {/* Status chips */}
          <div className="flex-1 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-md border border-cyan-800/30 bg-cyan-950/20 px-2.5 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
              <span className="text-[9px] font-mono font-bold text-cyan-300 uppercase tracking-wider">{completedTasks.length}/{totalToday} Done</span>
            </div>
            {overdueCount > 0 && (
              <motion.div animate={{ opacity: pulse ? 1 : 0.5 }} className="flex items-center gap-1.5 rounded-md border border-red-800/30 bg-red-950/20 px-2.5 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                <span className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-wider">{overdueCount} Overdue</span>
              </motion.div>
            )}
            {completionRate === 100 && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 rounded-md border border-emerald-800/30 bg-emerald-950/20 px-2.5 py-1">
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Mission Complete</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* 3-Column Body — fills remaining viewport */}
      <div className="flex flex-1 overflow-hidden relative z-20">
        {/* Left: Completed + Missed */}
        <div className="w-[240px] shrink-0 border-r border-slate-800/40 bg-[#0b0f1c]/40 flex flex-col overflow-hidden">
          {/* Completed */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-b border-slate-800/30">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-emerald-500/60">Completed</span>
              <span className="ml-auto text-[9px] font-mono text-slate-600">{completedTasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {completedTasks.length === 0 ? (
                <p className="text-[9px] font-mono text-slate-700 text-center py-3">—</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-md bg-emerald-950/10 border border-emerald-900/20 px-2 py-1">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                    <span className="flex-1 text-[9px] font-mono text-slate-600 line-through truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Missed */}
          <div className="shrink-0 max-h-[30%] flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-red-500/60">Missed</span>
              <span className="ml-auto text-[9px] font-mono text-slate-600">{missedYesterday.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {missedYesterday.length === 0 ? (
                <p className="text-[9px] font-mono text-emerald-700 text-center py-2">None</p>
              ) : (
                missedYesterday.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-md bg-red-950/10 border border-red-900/20 px-2 py-1">
                    <XCircle className="h-2.5 w-2.5 text-red-700 shrink-0" />
                    <span className="flex-1 text-[9px] font-mono text-slate-600 truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Timeline */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* Right: Upcoming + Leaderboard */}
        <div className="w-[260px] shrink-0 border-l border-slate-800/40 bg-[#0b0f1c]/40 flex flex-col overflow-hidden hidden lg:flex">
          {/* Upcoming */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-b border-slate-800/30">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <Zap className="h-3 w-3 text-cyan-400" style={{ filter: "drop-shadow(0 0 4px rgba(6,182,212,0.5))" }} />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-cyan-500/60">Upcoming</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
            </div>
          </div>
          {/* Leaderboard */}
          <div className="shrink-0 max-h-[40%] flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <Trophy className="h-3 w-3 text-amber-400" style={{ filter: "drop-shadow(0 0 4px rgba(245,158,11,0.4))" }} />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-amber-500/60">Rankings</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <Leaderboard currentLocationId={currentLocationId} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
