"use client";

import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Flame,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import type { DashboardLayoutProps } from "./layout-props";

/*
 * BENTO — Asymmetric CSS grid (Apple keynote style)
 *
 * Grid template (6 cols × 3 rows):
 *   Row 1 (auto):  [progress ×2] [points] [status] [quote ×2]
 *   Row 2 (1fr):   [timeline ×4]                    [upcoming ×2]
 *   Row 3 (1fr):   [completed ×2] [missed] [leader] [upcoming ×2]
 *
 * The timeline is the biggest card (4 cols, 1 row).
 * Upcoming is tall (2 cols, 2 rows).
 * Stats are small. Completed is wide. Missed & leaderboard are square.
 */

const card = "rounded-3xl bg-white/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/50 shadow-sm backdrop-blur-sm overflow-hidden";

export function BentoLayout({
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
  const circ = 2 * Math.PI * 40;
  const dash = (pct / 100) * circ;
  const overdueCount = allTasks.filter((t) => !t.isCompleted && t.isOverdue).length;
  const dueSoonCount = allTasks.filter((t) => !t.isCompleted && t.isDueSoon && !t.isOverdue).length;

  return (
    <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-3">
      <div
        className="h-full gap-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gridTemplateRows: "auto 1fr 1fr",
          gridTemplateAreas: `
            "progress progress points status quote quote"
            "timeline timeline timeline timeline upcoming upcoming"
            "completed completed missed leader upcoming upcoming"
          `,
        }}
      >
        {/* ── Progress Ring (hero) ── */}
        <motion.div
          style={{ gridArea: "progress" }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-gradient-to-br from-[var(--hub-red)] via-rose-600 to-pink-700 p-4 text-white shadow-lg shadow-red-200/30 dark:shadow-red-950/30 relative overflow-hidden flex items-center gap-4"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative h-16 w-16 shrink-0">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
              <motion.circle cx="44" cy="44" r="40" fill="none" strokeWidth="5" strokeLinecap="round" stroke="white"
                initial={{ strokeDasharray: `0 ${circ}` }}
                animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
                transition={{ duration: 1 }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-black">{pct}%</span>
          </div>
          <div className="relative z-10">
            <p className="text-lg font-bold">{completedTasks.length}/{totalToday} tasks</p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">
              {pct === 100 ? "All done!" : "Today\u2019s progress"}
            </p>
          </div>
        </motion.div>

        {/* ── Points ── */}
        <div style={{ gridArea: "points" }} className={cn(card, "flex items-center justify-center p-4")}>
          <div className="text-center">
            <Trophy className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <motion.p key={pointsToday} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-2xl font-black text-slate-900 dark:text-white">{pointsToday}</motion.p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Points</p>
          </div>
        </div>

        {/* ── Status ── */}
        <div style={{ gridArea: "status" }} className={cn(card, "flex items-center justify-center p-4", overdueCount > 0 && "border-red-200 dark:border-red-800/40")}>
          <div className="text-center">
            {overdueCount > 0 ? <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-1" /> : dueSoonCount > 0 ? <Clock className="h-6 w-6 text-amber-500 mx-auto mb-1" /> : <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />}
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {overdueCount > 0 ? `${overdueCount} overdue` : dueSoonCount > 0 ? `${dueSoonCount} due soon` : pct === 100 ? "All clear" : "On track"}
            </p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Status</p>
          </div>
        </div>

        {/* ── Quote ── */}
        <div style={{ gridArea: "quote" }} className={cn(card, "flex items-center px-5 py-3")}>
          <MotivationalQuote />
        </div>

        {/* ── Timeline (biggest card) ── */}
        <div style={{ gridArea: "timeline" }} className={cn(card, "flex flex-col")}>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {currentTime && (
              <Timeline tasks={allTasks} onComplete={onComplete} onUncomplete={onUncomplete} currentTime={currentTime} />
            )}
          </div>
        </div>

        {/* ── Upcoming (tall card, spans 2 rows) ── */}
        <div style={{ gridArea: "upcoming" }} className={cn(card, "flex flex-col")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Upcoming</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
          </div>
        </div>

        {/* ── Completed (wide) ── */}
        <div style={{ gridArea: "completed" }} className={cn(card, "flex flex-col")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Completed</span>
            <span className="ml-auto text-[10px] text-slate-400 font-medium">{completedTasks.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {completedTasks.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-3">Nothing yet</p>
            ) : (
              completedTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="flex-1 text-[10px] text-slate-500 line-through truncate">{t.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Missed ── */}
        <div style={{ gridArea: "missed" }} className={cn(card, "flex flex-col", missedYesterday.length > 0 && "border-red-200/60 dark:border-red-800/30")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Missed</span>
            <span className="ml-auto text-[10px] text-red-400 font-medium">{missedYesterday.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {missedYesterday.length === 0 ? (
              <p className="text-[10px] text-emerald-500 text-center py-3">None!</p>
            ) : (
              missedYesterday.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-red-50/60 dark:bg-red-950/20 px-2.5 py-1">
                  <XCircle className="h-3 w-3 text-red-300 shrink-0" />
                  <span className="flex-1 text-[10px] text-slate-500 truncate">{t.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Leaderboard ── */}
        <div style={{ gridArea: "leader" }} className={cn(card, "flex flex-col")}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ranks</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <Leaderboard currentLocationId={currentLocationId} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
