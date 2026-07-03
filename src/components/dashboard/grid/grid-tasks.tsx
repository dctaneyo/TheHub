"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, ChevronRight, X, CheckCircle2, XCircle, Info } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { IconTip } from "@/components/ui/icon-tip";
import type { TaskItem } from "@/components/dashboard/timeline";

/**
 * Minimal Today's Tasks widget — the only tasks widget in the app.
 *
 * - Completion ring + remaining/completed counts at the top
 * - One-line bold task rows with a checkbox to complete
 * - Overdue tasks shown in red; completed tasks drop out of the list
 * - Clicking the ring navigates to /tasks (the full multi-day/history/
 *   filtering view — see that route) instead of opening a same-page modal.
 */

function formatTime(time: string, isAllDay?: boolean): string {
  if (isAllDay) return "All Day";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const byDueTime = (a: TaskItem, b: TaskItem) =>
  a.dueTime < b.dueTime ? -1 : a.dueTime > b.dueTime ? 1 : 0;

// Earned Delight instance (DESIGN.md Section 20) — trigger: remainingCount
// crosses from >0 to 0 while the widget is mounted (never on initial mount
// already-complete, so reopening the widget after finishing doesn't replay
// it). Effect: the ring holds a distinct filled checkmark state for ~2.5s,
// then settles back to the normal 100%/COMPLETE display — now in green
// (pct === 100) instead of red, which is a correctness change, not part of
// the flourish. One instance only, per Section 20's own scope cap.
function CompletionRing({
  pct,
  justCompleted,
  onClick,
}: {
  pct: number;
  justCompleted: boolean;
  onClick?: () => void;
}) {
  const size = 104;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const ringColor = pct === 100 ? "var(--hub-green)" : "var(--hub-red)";

  return (
    <IconTip label="View all tasks for today">
    <motion.button
      type="button"
      onClick={onClick}
      title="View all tasks for today"
      whileTap={{ scale: 0.97 }}
      animate={justCompleted ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
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
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
        />
      </svg>
      <AnimatePresence mode="wait" initial={false}>
        {justCompleted ? (
          <motion.span
            key="celebrate"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute flex flex-col items-center leading-none"
          >
            <CheckCircle2 className="h-9 w-9" style={{ color: "var(--hub-green)" }} />
            <span className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground">
              ALL DONE
            </span>
          </motion.span>
        ) : (
          <motion.span
            key="percent"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute flex flex-col items-center leading-none"
          >
            <span className="text-3xl font-black text-foreground">{pct}%</span>
            <span className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground">
              COMPLETE
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
    </IconTip>
  );
}

export function GridTasksWidget({
  tasks,
  missedYesterday,
  onComplete,
}: {
  tasks: TaskItem[];
  missedYesterday: TaskItem[];
  onComplete: (taskId: string) => void;
}) {
  const router = useRouter();
  const [missedOpen, setMissedOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0 });
  const missedBtnRef = useRef<HTMLButtonElement>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [prevRemaining, setPrevRemaining] = useState<number | null>(null);

  const { total, completedCount, remainingCount, pct, pending } =
    useMemo(() => {
      // Information tasks are not actionable — exclude from all counts/progress
      const actionable = tasks.filter((t) => t.type !== "information");
      const total = actionable.length;
      const completedCount = actionable.filter((t) => t.isCompleted).length;
      const remainingCount = total - completedCount;
      const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      // Pending list still shows information tasks (with info icon, no checkmark)
      const pending = tasks.filter((t) => !t.isCompleted).slice().sort(byDueTime);
      return { total, completedCount, remainingCount, pct, pending };
    }, [tasks]);

  // Earned Delight trigger (DESIGN.md Section 20) — fires only on a genuine
  // >0 → 0 transition observed while mounted, never when the widget mounts
  // already at 0 (so reopening after finishing today doesn't replay it).
  // Derived during render (React's documented pattern for state depending on
  // a prop change) rather than in an effect, since the detection itself is
  // synchronous — the effect below only owns the timer, a real side effect.
  if (prevRemaining !== remainingCount) {
    const justFinished = prevRemaining !== null && prevRemaining > 0 && remainingCount === 0 && total > 0;
    setPrevRemaining(remainingCount);
    if (justFinished) setJustCompleted(true);
  }

  useEffect(() => {
    if (!justCompleted) return;
    const timer = setTimeout(() => setJustCompleted(false), 2500);
    return () => clearTimeout(timer);
  }, [justCompleted]);

  return (
    <div className="flex h-full flex-col">
      {/* Header — same icon+title pattern as every other data widget
          (Messages, Upcoming, Calendar), so the widget identifies itself
          instead of relying on the ring below to imply "this is tasks."
          Tapping it navigates to /tasks — the chevron is the signifier that
          it's tappable, replacing the old floating corner Expand button
          (one bigger, consistent touch target instead of a separate icon). */}
      <button
        type="button"
        onClick={() => router.push("/tasks")}
        className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3 text-left transition-colors active:bg-muted/60"
      >
        <CheckSquare className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-lg font-semibold text-foreground">Today&apos;s Tasks</h2>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </button>

      {/* Ring + counts */}
      <div className="flex shrink-0 flex-col items-center gap-3 px-3 pb-3">
        <CompletionRing pct={pct} justCompleted={justCompleted} onClick={() => router.push("/tasks")} />

        <div className="flex w-full max-w-[240px] flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-foreground">
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
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full bg-yellow-400"
              />
              Remaining:
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {remainingCount} {remainingCount === 1 ? "task" : "tasks"}
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
            className="flex w-full items-center justify-between rounded-lg px-0 py-1 transition-colors active:text-[var(--hub-red)]"
          >
            <span className="flex items-center gap-2 font-semibold text-foreground">
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
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/60 px-3 pb-3 pt-2">
        {pending.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2
              className="h-8 w-8"
              style={{ color: "var(--hub-green)" }}
            />
            <p className="text-sm font-semibold text-muted-foreground">
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
                className="flex items-center gap-3 border-b border-border/40 py-3"
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm font-semibold",
                    task.isOverdue ? "text-[var(--hub-red)]" : "text-foreground"
                  )}
                >
                  [{formatTime(task.dueTime, task.isAllDay)}] {task.title}
                </span>
                {task.type === "information" ? (
                  /* Information tasks are not actionable — show a static info icon */
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <Info className="h-6 w-6 text-blue-400" />
                  </span>
                ) : (
                  /* Touch-friendly complete button */
                  <IconTip label="Mark complete">
                    <button
                      type="button"
                      onClick={() => onComplete(task.id)}
                      title="Mark complete"
                      className="group/cb flex h-11 w-11 shrink-0 items-center justify-center"
                    >
                      <CheckCircle2 className="h-7 w-7 text-muted-foreground/25 transition-colors group-active/cb:text-[var(--hub-green)]" />
                    </button>
                  </IconTip>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

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
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-semibold text-foreground">Missed Yesterday</span>
                <button
                  type="button"
                  onClick={() => setMissedOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground transition-colors active:text-foreground"
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
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
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
