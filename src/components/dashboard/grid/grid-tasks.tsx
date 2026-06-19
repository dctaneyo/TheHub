"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, XCircle } from "@/lib/icons";
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
        <span className="text-3xl font-black text-foreground">{pct}%</span>
        <span className="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground">
          COMPLETE
        </span>
      </span>
    </button>
  );
}

export function GridTasksWidget({
  tasks,
  missedYesterday,
  onComplete,
  onUncomplete,
  externalModalOpen,
  onExternalModalClose,
}: {
  tasks: TaskItem[];
  missedYesterday: TaskItem[];
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  /** When true, the fullscreen modal is forced open (e.g. via the expand button). */
  externalModalOpen?: boolean;
  onExternalModalClose?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [missedOpen, setMissedOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0 });
  const missedBtnRef = useRef<HTMLButtonElement>(null);

  // Sync external trigger — when the parent flips externalModalOpen to true,
  // open the modal; the parent resets it when we call onExternalModalClose.
  useEffect(() => {
    if (externalModalOpen) setModalOpen(true);
  }, [externalModalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    onExternalModalClose?.();
  };

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

        <div className="flex w-full max-w-[240px] flex-col gap-1 text-base">
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
          {/* Missed Yesterday — clickable row that opens a popover */}
          <button
            ref={missedBtnRef}
            type="button"
            onClick={() => {
              if (missedBtnRef.current) {
                const r = missedBtnRef.current.getBoundingClientRect();
                setPopoverPos({ top: r.bottom + 6, left: r.left, width: r.width });
              }
              setMissedOpen((o) => !o);
            }}
            className="flex w-full items-center justify-between rounded-lg px-0 py-0.5 transition-colors hover:text-[var(--hub-red)]"
          >
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--hub-red)" }}
              />
              Missed (Yesterday):
            </span>
            <span className={cn("font-semibold tabular-nums", missedYesterday.length > 0 ? "text-[var(--hub-red)]" : "text-foreground")}>
              {missedYesterday.length} {missedYesterday.length === 1 ? "task" : "tasks"}
            </span>
          </button>
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
            <p className="text-base font-medium text-muted-foreground">
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
                    "min-w-0 flex-1 truncate text-base font-bold",
                    task.isOverdue ? "text-[var(--hub-red)]" : "text-foreground"
                  )}
                >
                  [{formatTime(task.dueTime)}] {task.title}
                </span>
                {/* Touch-friendly complete button — same CheckCircle2 icon as completed state, muted until hovered */}
                <button
                  type="button"
                  onClick={() => onComplete(task.id)}
                  title="Mark complete"
                  className="group/cb flex h-11 w-11 shrink-0 items-center justify-center"
                >
                  <CheckCircle2 className="h-7 w-7 text-muted-foreground/25 transition-colors group-hover/cb:text-[var(--hub-green)] group-active/cb:text-[var(--hub-green)]" />
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
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="fixed inset-4 z-[201] flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl md:inset-12"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Today&apos;s Tasks
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {pct}% complete · {completedCount}/{total} done
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
                {allSorted.length === 0 && (
                  <p className="py-8 text-center text-base text-muted-foreground">
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
                      <span className="w-24 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                        {formatTime(task.dueTime)}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-base font-semibold",
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
                          className="group/undo flex h-11 w-11 shrink-0 items-center justify-center"
                        >
                          <CheckCircle2 className="h-7 w-7 text-[var(--hub-green)] transition-colors group-hover/undo:text-[var(--hub-red)] group-active/undo:text-[var(--hub-red)]" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onComplete(task.id)}
                          title="Mark complete"
                          className="group/cb flex h-11 w-11 shrink-0 items-center justify-center"
                        >
                          <CheckCircle2 className="h-7 w-7 text-muted-foreground/25 transition-colors group-hover/cb:text-[var(--hub-green)] group-active/cb:text-[var(--hub-green)]" />
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

      {/* Missed Yesterday popover — fixed so it escapes the overflow-hidden card */}
      <AnimatePresence>
        {missedOpen && (
          <>
            {/* Backdrop — click anywhere to close */}
            <div
              className="fixed inset-0 z-[300]"
              onClick={() => setMissedOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[301] min-w-[240px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
              style={{
                top: popoverPos.top,
                left: popoverPos.left,
                width: Math.max(popoverPos.width, 260),
              }}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <span className="text-sm font-bold text-foreground">Missed Yesterday</span>
                <button
                  type="button"
                  onClick={() => setMissedOpen(false)}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                {missedYesterday.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nothing missed yesterday
                  </p>
                ) : (
                  missedYesterday.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-xl bg-red-50/60 px-3 py-2 dark:bg-red-950/30"
                    >
                      <XCircle className="h-4 w-4 shrink-0 text-[var(--hub-red)]" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatTime(task.dueTime)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
