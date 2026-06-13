"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, CheckCircle2 } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/components/dashboard/timeline";

/**
 * Minimal Today's Tasks widget for the GRID dashboard only.
 * (The classic dashboard route still uses <Timeline>, untouched.)
 *
 * - Completion ring + remaining/completed counts at the top
 * - One-line bold task rows with a checkbox to complete
 * - Overdue tasks shown in red; completed tasks drop out of the list
 * - Clicking the ring opens a fullscreen modal with the full day in order
 */

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const byDueTime = (a: TaskItem, b: TaskItem) =>
  a.dueTime < b.dueTime ? -1 : a.dueTime > b.dueTime ? 1 : 0;

function CompletionRing({
  pct,
  onClick,
}: {
  pct: number;
  onClick?: () => void;
}) {
  const size = 104;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <button
      type="button"
      onClick={onClick}
      title="View all tasks for today"
      className="relative inline-flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-[1.03]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--hub-red)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <span className="text-2xl font-black text-foreground">{pct}%</span>
        <span className="mt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          COMPLETE
        </span>
      </span>
    </button>
  );
}

export function GridTasksWidget({
  tasks,
  onComplete,
  onUncomplete,
}: {
  tasks: TaskItem[];
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const { total, completedCount, remainingCount, pct, pending, allSorted } =
    useMemo(() => {
      const total = tasks.length;
      const completedCount = tasks.filter((t) => t.isCompleted).length;
      const remainingCount = total - completedCount;
      const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      const pending = tasks.filter((t) => !t.isCompleted).slice().sort(byDueTime);
      const allSorted = tasks.slice().sort(byDueTime);
      return { total, completedCount, remainingCount, pct, pending, allSorted };
    }, [tasks]);

  return (
    <div className="flex h-full flex-col p-3">
      {/* Header: ring + counts */}
      <div className="flex shrink-0 flex-col items-center gap-3 pb-3">
        <CompletionRing pct={pct} onClick={() => setModalOpen(true)} />

        <div className="flex w-full max-w-[240px] flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--hub-red)" }}
              />
              Remaining:
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {remainingCount} {remainingCount === 1 ? "task" : "tasks"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--hub-green)" }}
              />
              Completed:
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {completedCount} {completedCount === 1 ? "task" : "tasks"}
            </span>
          </div>
        </div>
      </div>

      {/* Pending list (completed tasks are removed entirely) */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/60 pt-1">
        {pending.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2
              className="h-8 w-8"
              style={{ color: "var(--hub-green)" }}
            />
            <p className="text-sm font-medium text-muted-foreground">
              {total === 0 ? "No tasks today" : "All tasks complete"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {pending.map((task) => (
              <motion.div
                key={task.id}
                layout
                exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                className="flex items-center gap-3 border-b border-border/40 py-2.5"
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm font-bold",
                    task.isOverdue ? "text-[var(--hub-red)]" : "text-foreground"
                  )}
                >
                  [{formatTime(task.dueTime)}] {task.title}
                </span>
                {/* Touch-friendly checkbox: 44×44 tap target */}
                <button
                  type="button"
                  onClick={() => onComplete(task.id)}
                  title="Mark complete"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-muted-foreground/30 transition-colors active:border-[var(--hub-green)] active:bg-[var(--hub-green)]/10"
                >
                  <Check className="h-5 w-5 text-[var(--hub-green)]" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Fullscreen modal — full day in chronological order */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="fixed inset-4 z-[201] flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl md:inset-12"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Today&apos;s Tasks
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {pct}% complete · {completedCount}/{total} done
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
                {allSorted.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No tasks scheduled today
                  </p>
                )}
                {allSorted.map((task) => {
                  const done = task.isCompleted;
                  const overdue = !done && task.isOverdue;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 px-3 py-3"
                    >
                      <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {formatTime(task.dueTime)}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-semibold",
                          done && "text-[var(--hub-green)] line-through opacity-70",
                          overdue && "text-[var(--hub-red)]",
                          !done && !overdue && "text-foreground"
                        )}
                      >
                        {task.title}
                      </span>
                      {done ? (
                        <button
                          type="button"
                          onClick={() => onUncomplete(task.id)}
                          title="Undo — mark as not complete"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        >
                          <CheckCircle2 className="h-7 w-7 text-[var(--hub-green)] transition-colors active:text-[var(--hub-red)]" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onComplete(task.id)}
                          title="Mark complete"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-muted-foreground/30 transition-colors active:border-[var(--hub-green)] active:bg-[var(--hub-green)]/10"
                        >
                          <Check className="h-5 w-5 text-[var(--hub-green)]" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
