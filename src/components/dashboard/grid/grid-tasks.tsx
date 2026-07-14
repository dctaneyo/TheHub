"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  ChevronRight,
  X,
  XCircle,
  Info,
  CheckCircle2,
  ClipboardList,
  SprayCan,
  Clock,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TaskItem } from "@/components/dashboard/timeline";

/**
 * Today's Tasks widget — a "Now/Next" two-tier display (2026-07-04,
 * replacing an earlier stacked-card redesign — see Changelog for why: a
 * leaning card-fan needs a fixed, generous canvas to read as a stack of
 * cards, which fights a widget that lives in an arbitrarily resizable grid
 * cell. Every fix to that design was margin/geometry triage; the fan itself
 * was the wrong shape for this container).
 *
 * - The current (soonest-due, uncompleted) task is shown prominently, with
 *   its own progress bar, icon/time/title, and a Complete button.
 * - A single quieter row below shows what's next — not a running list of
 *   everything remaining, just the one task after the current one — so
 *   "what's coming" reads at a glance without any stacking/depth chrome.
 *   Tapping the front card or the Next row opens a grid of every task
 *   today, completable directly — the escape hatch for the out-of-order
 *   case (dueTime order is a soft, practical sequence, not an enforced
 *   one).
 * - A horizontal progress bar sits inside the front card, with real
 *   padding around it rather than flush against its top edge — replaces
 *   the old completion ring; Section 18 only gets one signal for this
 *   fact, not two.
 * - The widget's own outer frame is gone (see hidesOwnFrame in
 *   grid-engine.ts) — the front card already supplies its own boundary, so
 *   a second frame around the whole widget would restate one already
 *   given by the card. The icon+title header stays, unlike the
 *   fully-ambient widgets (Clock, Quote): a task card isn't as
 *   self-evidently "Today's Tasks" as a giant clock is self-evidently a
 *   clock.
 */

const TYPE_ICON: Partial<Record<string, typeof ClipboardList>> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
  information: Info,
};

function formatTime(time: string, isAllDay?: boolean): string {
  if (isAllDay) return "All Day";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// The front card + Next row scale with the widget's own size instead of
// staying a small fixed box centered in a lot of empty space (2026-07-14:
// a widget resized tall — a real, already-in-use case, not hypothetical —
// left most of its height unused once the stack's fan stopped needing that
// room). `containerType: size` on the centering wrapper below turns cqw/cqh
// units into "% of this widget," not "% of the viewport," so every size
// here scales with the widget itself, clamped between what the old fixed
// stacked-card design used (the min) and a sane hero-sized ceiling (the
// max) so it doesn't blow up on an enormous widget.
//
// Text/icon sizes use `min(Xcqh, Ycqw)` rather than height alone — a widget
// resized tall *and* narrow (the real layout this was tuned against) grew
// text fast enough on height alone to truncate the task title and wrap the
// header row, since nothing was checking whether the width could actually
// fit it. Bar thickness and gaps don't carry that risk (a bar just spans
// the width at whatever thickness; a gap has no content to overflow), so
// those stay height-only.
const SCALE_VARS: React.CSSProperties = {
  ["--now-icon" as string]: "clamp(40px, min(18cqh, 20cqw), 140px)",
  ["--now-title" as string]: "clamp(16px, min(7cqh, 7cqw), 46px)",
  ["--now-meta" as string]: "clamp(12px, min(3.4cqh, 3.4cqw), 26px)",
  ["--now-btn-h" as string]: "clamp(44px, 14cqh, 96px)",
  ["--now-btn-text" as string]: "clamp(14px, min(4.2cqh, 5cqw), 28px)",
  ["--now-bar-h" as string]: "clamp(6px, 2cqh, 16px)",
  ["--now-pad" as string]: "clamp(16px, 4cqw, 32px)",
  ["--now-icon-gap" as string]: "clamp(12px, 3cqw, 24px)",
  ["--now-gap" as string]: "clamp(12px, 4cqh, 40px)",
  ["--next-title" as string]: "clamp(14px, min(4.6cqh, 4.6cqw), 32px)",
  ["--next-meta" as string]: "clamp(11px, min(3cqh, 3cqw), 22px)",
  ["--next-pad-y" as string]: "clamp(8px, 2.4cqh, 24px)",
  ["--next-pad-x" as string]: "clamp(12px, 3cqw, 20px)",
  maxWidth: "clamp(280px, 70cqw, 560px)",
};

const byDueTime = (a: TaskItem, b: TaskItem) =>
  a.dueTime < b.dueTime ? -1 : a.dueTime > b.dueTime ? 1 : 0;

// The current task's content — sized via the --now-* scale variables (see
// SCALE_VARS) so it grows with the widget instead of staying fixed while
// the widget around it grows. Only used for the front "Now" card; the
// expand-all modal has its own fixed-size row, deliberately not scaled —
// that grid's row count varies with how many tasks there are today, not
// with the widget's size, so a "hero" treatment there would fight itself.
function TaskCardBody({ task }: { task: TaskItem }) {
  const Icon = TYPE_ICON[task.type] ?? ClipboardList;
  return (
    <div className="flex min-w-0 flex-1 items-start" style={{ gap: "var(--now-icon-gap)" }}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl",
          task.isOverdue ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)]" : "bg-primary/10 text-primary"
        )}
        style={{ width: "var(--now-icon)", height: "var(--now-icon)" }}
      >
        <Icon style={{ width: "50%", height: "50%" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn("truncate font-semibold tabular-nums", task.isOverdue ? "text-[var(--hub-red)]" : "text-muted-foreground")}
          style={{ fontSize: "var(--now-meta)" }}
        >
          {formatTime(task.dueTime, task.isAllDay)}{task.isOverdue ? " · Overdue" : ""}
        </p>
        <p className="mt-0.5 line-clamp-2 font-semibold leading-tight text-foreground" style={{ fontSize: "var(--now-title)" }}>
          {task.title}
        </p>
      </div>
    </div>
  );
}

// Earned Delight instance (DESIGN.md Section 20) — same approved trigger and
// effect as before (remainingCount crosses >0 → 0 while mounted, never on an
// already-complete mount), relocated onto the redesigned stack rather than
// proposed as a second instance: the ring it used to live on is gone, but
// the event and response are unchanged, just re-homed to a card in the
// stack's position instead of a ring's center label.
function AllDoneCard() {
  return (
    <motion.div
      key="all-done"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <motion.div
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <CheckCircle2 className="h-10 w-10" style={{ color: "var(--hub-green)" }} />
      </motion.div>
      <p className="text-sm font-semibold text-foreground">All done for today</p>
    </motion.div>
  );
}

function EmptyStack({ total }: { total: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <CheckCircle2 className="h-8 w-8" style={{ color: "var(--hub-green)" }} />
      <p className="text-sm font-semibold text-muted-foreground">
        {total === 0 ? "No tasks today" : "All tasks complete"}
      </p>
    </div>
  );
}

export function GridTasksWidget({
  tasks,
  missedYesterday,
  onComplete,
}: {
  tasks: TaskItem[];
  missedYesterday: TaskItem[];
  onComplete: (taskId: string) => Promise<boolean>;
}) {
  const router = useRouter();
  const [missedOpen, setMissedOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0 });
  const missedBtnRef = useRef<HTMLButtonElement>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [prevRemaining, setPrevRemaining] = useState<number | null>(null);
  // Set when a completion actually fails, so a reverted card reads as "that
  // didn't work, try again" instead of silently un-completing itself with
  // no explanation (the bug this was added to fix, 2026-07-03).
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Information tasks have no persistent complete state (see TaskCardBody's
  // type icon and the widget doc comment) — "Got it" only dismisses one from
  // *this* viewing session's stack, same as the old list always re-showing
  // it after a reload.
  const [dismissedInfoIds, setDismissedInfoIds] = useState<Set<string>>(new Set());

  const { total, completedCount, remainingCount, pending, allToday } =
    useMemo(() => {
      // Information tasks are not actionable — excluded from progress counts
      const actionable = tasks.filter((t) => t.type !== "information");
      const total = actionable.length;
      const completedCount = actionable.filter((t) => t.isCompleted).length;
      const remainingCount = total - completedCount;
      const allToday = tasks.slice().sort(byDueTime);
      const pending = tasks
        .filter((t) => !t.isCompleted && !dismissedInfoIds.has(t.id))
        .slice()
        .sort(byDueTime);
      return { total, completedCount, remainingCount, pending, allToday };
    }, [tasks, dismissedInfoIds]);

  // Earned Delight trigger — unchanged logic from the ring version, derived
  // during render rather than in an effect (state-from-a-prop-change is the
  // documented React pattern; avoids the react-hooks/set-state-in-effect
  // cascading-render warning the original ring implementation hit).
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

  const front = pending[0];
  const next = pending[1];
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const handleFrontAction = async (task: TaskItem) => {
    if (task.type === "information") {
      setDismissedInfoIds((prev) => new Set(prev).add(task.id));
      return;
    }
    setCompleteError(null);
    const ok = await onComplete(task.id);
    if (!ok) setCompleteError("Couldn't mark that complete — try again.");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header — tapping it navigates to /tasks, same as every other data
          widget. The stack below has its own tap-to-expand, so the header
          stays the "go to the full route" affordance, the card the
          "see just today" one — two different scopes, not duplicated. */}
      <button
        type="button"
        onClick={() => router.push("/tasks")}
        className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-3 text-left transition-colors active:bg-muted/60"
      >
        <CheckSquare className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-lg font-semibold text-foreground">Today&apos;s Tasks</h2>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </button>

      {/* Missed Yesterday — compact pill, own popover, unrelated to today's
          stack/progress so it stays out of that math entirely. */}
      <div className="flex shrink-0 justify-end px-3 pb-2">
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
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
            missedYesterday.length > 0
              ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)] active:bg-[var(--hub-red)]/15"
              : "text-muted-foreground active:bg-muted"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--hub-red)" }} />
          Missed yesterday: {missedYesterday.length}
        </button>
      </div>

      {/* The stack */}
      <div className="relative min-h-0 flex-1 px-3 pb-3">
        <AnimatePresence mode="wait">
          {justCompleted ? (
            <AllDoneCard />
          ) : !front ? (
            <motion.div key="empty" className="h-full">
              <EmptyStack total={total} />
            </motion.div>
          ) : (
            <div
              key="now-next"
              className="flex h-full w-full flex-col items-center justify-center gap-3"
              style={{ containerType: "size" } as React.CSSProperties}
            >
              <div className="flex w-full flex-col" style={{ ...SCALE_VARS, gap: "var(--now-gap)" }}>
                {/* Now — the current task, prominent. Scales with the
                    widget's own size (see SCALE_VARS) instead of staying a
                    small fixed box centered in unused space. */}
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={front.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    {/* Progress bar — inside the card, with real padding
                        around it rather than flush against the card's
                        rounded top edge. */}
                    <div style={{ padding: "var(--now-pad)", paddingBottom: 0 }}>
                      <div
                        className="w-full overflow-hidden rounded-full bg-muted"
                        style={{ height: "var(--now-bar-h)" }}
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${pct}%`, background: "var(--hub-green)" }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandOpen(true)}
                      className="flex items-center justify-between gap-2 pt-3 text-left font-semibold text-muted-foreground transition-colors active:text-foreground"
                      style={{ paddingLeft: "var(--now-pad)", paddingRight: "var(--now-pad)", fontSize: "var(--now-meta)" }}
                    >
                      <span className="tabular-nums">{completedCount}/{total} tasks complete</span>
                      <span className="flex items-center gap-1">
                        View all today
                        <ChevronRight className="h-[1em] w-[1em]" />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandOpen(true)}
                      className="flex items-start pt-3 text-left"
                      style={{ paddingLeft: "var(--now-pad)", paddingRight: "var(--now-pad)" }}
                    >
                      <TaskCardBody task={front} />
                    </button>

                    <div style={{ padding: "var(--now-pad)", paddingTop: "calc(var(--now-pad) * 0.75)" }}>
                      {completeError && (
                        <p
                          className="mb-2 text-center font-semibold text-[var(--hub-red)]"
                          style={{ fontSize: "var(--now-meta)" }}
                        >
                          {completeError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleFrontAction(front); }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-colors active:opacity-90"
                        style={{
                          height: "var(--now-btn-h)",
                          fontSize: "var(--now-btn-text)",
                          background: front.type === "information" ? "var(--primary)" : "var(--hub-green)",
                        }}
                      >
                        <CheckCircle2 className="h-[1em] w-[1em]" />
                        {front.type === "information" ? "Got it" : "Complete"}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Next — one quieter row for the task after this one, not
                    a running list of everything remaining. Absent entirely
                    when there's nothing after the current task. Scales more
                    modestly than the Now card (its own, smaller --next-*
                    variables) so it stays visually subordinate even as the
                    widget grows. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {next && (
                    <motion.button
                      key={next.id}
                      layout
                      type="button"
                      onClick={() => setExpandOpen(true)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 text-left transition-colors active:bg-muted"
                      style={{ padding: "var(--next-pad-y) var(--next-pad-x)" }}
                    >
                      <span className="shrink-0 font-semibold text-muted-foreground" style={{ fontSize: "var(--next-meta)" }}>
                        Next
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground" style={{ fontSize: "var(--next-title)" }}>
                        {next.title}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground" style={{ fontSize: "var(--next-meta)" }}>
                        {formatTime(next.dueTime, next.isAllDay)}
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Missed Yesterday popover */}
      <AnimatePresence>
        {missedOpen && (
          <>
            <div className="fixed inset-0 z-[300]" onClick={() => setMissedOpen(false)} />
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

      {/* Expanded view — today only, a quick grid, not a second /tasks.
          Every card here is completable directly, the escape hatch for
          completing something out of the stack's due-time order. */}
      <Dialog open={expandOpen} onOpenChange={(d) => setExpandOpen(d.open)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Today&apos;s Tasks</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allToday.map((task) => {
                const Icon = TYPE_ICON[task.type] ?? ClipboardList;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      task.isCompleted ? "border-border bg-muted/40" : "border-border bg-card"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        task.isOverdue && !task.isCompleted ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)]" : "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold", task.isCompleted ? "text-muted-foreground line-through" : "text-foreground")}>
                        {task.title}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatTime(task.dueTime, task.isAllDay)}
                      </p>
                    </div>
                    {task.type !== "information" && (
                      <button
                        type="button"
                        onClick={() => { void onComplete(task.id); }}
                        disabled={task.isCompleted}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors active:bg-muted disabled:opacity-40"
                      >
                        <CheckCircle2
                          className="h-5 w-5"
                          style={{ color: task.isCompleted ? "var(--hub-green)" : "var(--muted-foreground)" }}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
              {allToday.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No tasks today</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setExpandOpen(false); router.push("/tasks"); }}
            className="flex h-10 w-full shrink-0 items-center justify-center gap-1 rounded-xl bg-muted text-sm font-semibold text-foreground transition-colors active:bg-muted/80"
          >
            Open full Tasks history
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
