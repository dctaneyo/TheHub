"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  Undo2,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MotivationalQuote } from "@/components/dashboard/motivational-quote";
import type { DashboardLayoutProps } from "./layout-props";
import { useMirror } from "@/lib/mirror-context";

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

function Accordion({ title, icon: Icon, iconColor, count, defaultOpen, controlledOpen, onToggle, maxHeight = 200, children }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  count?: number;
  defaultOpen?: boolean;
  controlledOpen?: boolean;
  onToggle?: (open: boolean) => void;
  maxHeight?: number;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  return (
    <div className="border-b border-slate-200/60 dark:border-slate-700/40 last:border-b-0">
      <button
        onClick={() => { const next = !isOpen; setInternalOpen(next); onToggle?.(next); }}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-slate-400">{count}</span>
        )}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 overflow-y-auto" style={{ maxHeight }}>
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
  displayTime,
  upcomingTasks,
  currentLocationId,
  targetIsMobile = false,
  onComplete,
  onUncomplete,
  onEarlyComplete,
}: DashboardLayoutProps) {
  const pct = totalToday > 0 ? Math.round((completedTasks.length / totalToday) * 100) : 0;
  const circ = 2 * Math.PI * 34;
  const dash = (pct / 100) * circ;

  // ── Accordion state sync for mirror mode ──
  const { isMirroring, viewState: mirrorViewState, sendViewChange } = useMirror();
  const [accCompleted, setAccCompleted] = useState(true);
  const [accMissed, setAccMissed] = useState(false);
  const [accLeaderboard, setAccLeaderboard] = useState(false);
  const accSyncRef = useRef(false);

  // Sync accordion state FROM mirror context (mirror side: target → mirror)
  useEffect(() => {
    if (!mirrorViewState?.accordions) return;
    accSyncRef.current = true;
    const a = mirrorViewState.accordions;
    if (a.completed !== undefined) setAccCompleted(a.completed);
    if (a.missed !== undefined) setAccMissed(a.missed);
    if (a.leaderboard !== undefined) setAccLeaderboard(a.leaderboard);
    requestAnimationFrame(() => { accSyncRef.current = false; });
  }, [mirrorViewState?.accordions]);

  // Sync accordion state FROM ARL (target side: mirror → target via DOM event)
  useEffect(() => {
    if (isMirroring) return; // only on target side
    const handler = (e: Event) => {
      const a = (e as CustomEvent).detail;
      if (!a) return;
      accSyncRef.current = true;
      if (a.completed !== undefined) setAccCompleted(a.completed);
      if (a.missed !== undefined) setAccMissed(a.missed);
      if (a.leaderboard !== undefined) setAccLeaderboard(a.leaderboard);
      requestAnimationFrame(() => { accSyncRef.current = false; });
    };
    window.addEventListener("mirror:accordion-sync", handler);
    return () => window.removeEventListener("mirror:accordion-sync", handler);
  }, [isMirroring]);

  // Broadcast accordion changes
  useEffect(() => {
    if (accSyncRef.current) return;
    const acc = { completed: accCompleted, missed: accMissed, leaderboard: accLeaderboard };
    // Mirror side: send directly via mirror context
    if (isMirroring) {
      sendViewChange({ accordions: acc });
    }
    // Target side: dispatch custom event for dashboard to relay via capture manager
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mirror:accordion-change", { detail: acc }));
    }
  }, [accCompleted, accMissed, accLeaderboard, sendViewChange, isMirroring]);

  const incompleteTasks = useMemo(
    () => allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.dueTime.localeCompare(b.dueTime)),
    [allTasks]
  );

  const heroTask = incompleteTasks[0] ?? null;
  const upNextTasks = incompleteTasks.slice(1, 4);
  const laterTasks = incompleteTasks.slice(4);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ═══ LEFT SIDEBAR: Collapsible Accordions + Sticky Quote (hidden on mobile) ═══ */}
      <div className={cn("w-[260px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col overflow-hidden", targetIsMobile ? "hidden" : "flex")}>
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
          <Accordion title="Completed" icon={CheckCircle2} iconColor="text-emerald-500" count={completedTasks.length} defaultOpen={true} controlledOpen={accCompleted} onToggle={setAccCompleted}>
            {completedTasks.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-3">Nothing yet — get started!</p>
            ) : (
              <div className="space-y-1">
                {completedTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5 group">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="flex-1 text-[10px] text-slate-500 line-through truncate">{t.title}</span>
                    <span className="text-[8px] text-slate-400 shrink-0 group-hover:hidden">{formatTime12(t.dueTime)}</span>
                    <button
                      onClick={() => onUncomplete(t.id)}
                      className="hidden group-hover:flex items-center gap-0.5 text-[8px] font-bold text-amber-500 hover:text-amber-600 transition-colors shrink-0"
                      title="Undo completion"
                    >
                      <Undo2 className="h-2.5 w-2.5" /> Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          <Accordion title="Missed Yesterday" icon={XCircle} iconColor="text-red-400" count={missedYesterday.length} controlledOpen={accMissed} onToggle={setAccMissed}>
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

          <Accordion title="Leaderboard" icon={Trophy} iconColor="text-amber-500" maxHeight={350} controlledOpen={accLeaderboard} onToggle={setAccLeaderboard}>
            <Leaderboard currentLocationId={currentLocationId} compact />
          </Accordion>
        </div>

        {/* Sticky quote at bottom */}
        <div className="shrink-0 border-t border-slate-200/60 dark:border-slate-700/40 px-3 py-3">
          <MotivationalQuote />
        </div>
      </div>

      {/* ═══ MAIN AREA: flex column fills viewport height ═══ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* ── Mobile: Inline progress + accordions ── */}
        {targetIsMobile && (
          <div className="shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-slate-900">
            <div className="relative h-10 w-10 shrink-0">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 76 76">
                <circle cx="38" cy="38" r="34" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200 dark:text-slate-700" />
                <motion.circle cx="38" cy="38" r="34" fill="none" strokeWidth="5" strokeLinecap="round"
                  className={pct === 100 ? "text-emerald-500" : "text-[var(--hub-red)]"}
                  initial={{ strokeDasharray: `0 ${circ}` }}
                  animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
                  transition={{ duration: 0.8 }}
                  stroke="currentColor"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-800 dark:text-white">{pct}%</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white">{completedTasks.length}/{totalToday} tasks</p>
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-500">{pointsToday} pts</span>
              </div>
            </div>
            <p className="text-2xl font-extralight tabular-nums text-slate-800 dark:text-slate-100 shrink-0">
              {displayTime || currentTime}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-700/40">
            <Accordion title="Completed" icon={CheckCircle2} iconColor="text-emerald-500" count={completedTasks.length} defaultOpen={false} controlledOpen={accCompleted} onToggle={setAccCompleted}>
              {completedTasks.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-3">Nothing yet — get started!</p>
              ) : (
                <div className="space-y-1">
                  {completedTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5 group">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-500 line-through truncate">{t.title}</span>
                      <button
                        onClick={() => onUncomplete(t.id)}
                        className="hidden group-hover:flex items-center gap-0.5 text-[8px] font-bold text-amber-500 hover:text-amber-600 transition-colors shrink-0"
                      >
                        <Undo2 className="h-2.5 w-2.5" /> Undo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Accordion>
            <Accordion title="Missed Yesterday" icon={XCircle} iconColor="text-red-400" count={missedYesterday.length} controlledOpen={accMissed} onToggle={setAccMissed}>
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
            <Accordion title="Leaderboard" icon={Trophy} iconColor="text-amber-500" maxHeight={250} controlledOpen={accLeaderboard} onToggle={setAccLeaderboard}>
              <Leaderboard currentLocationId={currentLocationId} compact />
            </Accordion>
          </div>
        </div>
        )}

        {/* ── Prominent Clock (desktop only) ── */}
        {!targetIsMobile && (
          <div className="flex shrink-0 px-5 pt-4 pb-2 flex-col items-center">
          <p className="text-6xl font-extralight tabular-nums tracking-tight text-slate-800 dark:text-slate-100 leading-none">
            {displayTime || currentTime}
          </p>
          <p className="text-xs font-medium tracking-widest uppercase text-slate-400 dark:text-slate-500 mt-1.5">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          </div>
        )}

        {/* ── Hero Card: Extremely Prominent ── */}
        <div className="shrink-0 px-5 pt-2 pb-3">
          {heroTask ? (
            <motion.div
              key={heroTask.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative rounded-2xl overflow-hidden",
                heroTask.isOverdue
                  ? "bg-gradient-to-br from-red-600 via-red-500 to-rose-600 shadow-2xl shadow-red-500/30"
                  : heroTask.isDueSoon
                    ? "bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-2xl shadow-amber-500/30"
                    : "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700 shadow-2xl shadow-slate-900/40"
              )}
            >
              {/* Decorative glow circle */}
              <div className={cn(
                "absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl",
                heroTask.isOverdue ? "bg-red-300" : heroTask.isDueSoon ? "bg-amber-300" : "bg-white"
              )} />

              <div className="relative px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-widest",
                      heroTask.isOverdue || heroTask.isDueSoon ? "text-white/70" : "text-slate-400"
                    )}>
                      {heroTask.isOverdue ? "Overdue" : heroTask.isDueSoon ? "Due soon" : "Due at"}
                    </span>
                    <span className={cn(
                      "text-[11px] font-mono font-bold",
                      heroTask.isOverdue || heroTask.isDueSoon ? "text-white/60" : "text-slate-500"
                    )}>{formatTime12(heroTask.dueTime)}</span>
                    {heroTask.isOverdue && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="bg-white/20 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-sm"
                      >Overdue</motion.span>
                    )}
                    {heroTask.isDueSoon && !heroTask.isOverdue && (
                      <span className="bg-white/20 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-sm">Due Soon</span>
                    )}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-white leading-tight tracking-tight">{heroTask.title}</h1>
                  {heroTask.description && (
                    <p className={cn(
                      "text-xs md:text-sm mt-1.5 line-clamp-2 max-w-2xl",
                      heroTask.isOverdue || heroTask.isDueSoon ? "text-white/60" : "text-slate-400"
                    )}>{heroTask.description}</p>
                  )}
                  <div className="flex items-center gap-5 mt-3">
                    <span className={cn("flex items-center gap-1.5 text-xs", heroTask.isOverdue || heroTask.isDueSoon ? "text-white/50" : "text-slate-500")}>
                      {(() => { const Icon = typeIcons[heroTask.type] || Clock; return <Icon className="h-4 w-4" />; })()}
                      <span className="capitalize font-medium">{heroTask.type}</span>
                    </span>
                    <span className={cn("flex items-center gap-1 text-xs capitalize font-medium", heroTask.isOverdue || heroTask.isDueSoon ? "text-white/50" : "text-slate-500")}>{heroTask.priority}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
                      <Sparkles className="h-4 w-4" /> {heroTask.points} pts
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onComplete(heroTask.id)}
                  className={cn(
                    "shrink-0 flex items-center justify-center gap-2.5 rounded-2xl px-8 py-3 md:py-4 text-base md:text-lg font-black shadow-xl transition-all w-full md:w-auto",
                    heroTask.isOverdue || heroTask.isDueSoon
                      ? "bg-white text-slate-900 shadow-white/10 hover:bg-white/90"
                      : "bg-[var(--hub-red)] text-white shadow-red-500/20 hover:brightness-110"
                  )}
                >
                  <CheckCircle2 className="h-6 w-6" />
                  Done
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900 px-6 py-8 text-center shadow-xl"
            >
              <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">All Clear!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Every task is done. {pointsToday} points earned today.</p>
            </motion.div>
          )}
        </div>

        {/* ── Remaining tasks fill the rest of the viewport ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
          {/* ── Up Next: Card Grid ── */}
          {upNextTasks.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Up Next</h3>
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
                        "rounded-2xl border bg-white dark:bg-slate-900 p-3.5 shadow-sm border-l-4 flex flex-col gap-1.5",
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
                      {task.description && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug line-clamp-2">{task.description}</p>
                      )}
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
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Later</h3>
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
