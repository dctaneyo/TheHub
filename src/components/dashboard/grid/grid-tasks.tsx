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
 * Today's Tasks widget — redesigned 2026-07-01 from a flat scrolling list to
 * a stacked-card, one-at-a-time interface: user request, discussed against
 * DESIGN.md before building (see Changelog for the full reasoning and the
 * four questions it raised — task ordering, the progress signal, the
 * expanded view's relationship to /tasks, and the widget's own frame).
 *
 * - Tasks are shown one at a time, front card first (soonest due), with up
 *   to two peek cards fanned behind to show more remain — dueTime order is a
 *   soft, practical sequence (checklists usually run in due-time order), not
 *   an enforced one: tapping the front card opens a grid of every task today,
 *   completable directly, for the out-of-order case.
 * - A horizontal progress bar sits inside the front card, with real padding
 *   around it rather than flush against the card's top edge — replaces the
 *   old completion ring; Section 18 only gets one signal for this fact, not
 *   two. (2026-07-04: a first pass moved the bar entirely outside the card,
 *   into the empty space above it — but this widget hides its own outer
 *   frame (see hidesOwnFrame below), so that space has no visible boundary
 *   at all. "Floating" without anything to float *in* just reads as
 *   unrelated empty space, not as padding. The bar belongs inside the one
 *   boundary that actually exists: the card.)
 * - The widget's own outer frame is gone (see hidesOuterFrame in
 *   grid-engine.ts) — each card already supplies its own boundary, so a
 *   second frame around the whole widget restated one already given by the
 *   cards themselves. The icon+title header stays, unlike the fully-ambient
 *   widgets (Clock, Quote): a stack of cards isn't as self-evidently
 *   "Today's Tasks" as a giant clock is self-evidently a clock.
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

// The front card has a hard size cap, not just "fill the widget." Without
// one, a widget resized tall and narrow (a real case — the dashboard grid
// lets any widget be reshaped) stretches the card to match, and a very tall
// card makes even a small peek-card lean rotate into a huge pixel
// displacement at its corners (displacement scales with the card's own
// height) — exactly what caused a real clipping bug on a resized kiosk
// widget, 2026-07-04. Capping both dimensions keeps the geometry below
// bounded and predictable regardless of how the widget itself is shaped,
// and is also just what "make the cards smaller" (the same feedback) asked
// for directly. The stack centers within whatever space it's given, capped
// at this size, with real breathing room (STACK_PADDING) around it.
const CARD_MAX_WIDTH = 320;
const CARD_MAX_HEIGHT = 380;
// Worst-case rotation displacement is now calculable instead of open-ended:
// at CARD_MAX_HEIGHT, half-height is 190px, and the second peek's lean
// (2 * PEEK_LEAN = 6°) displaces its corners by 190 * sin(6°) ≈ 20px.
// STACK_PADDING is sized to clear that with room left over, which is only
// possible because the card's height is bounded — the same lean clipped
// before specifically because there was no such bound to size padding
// against (2026-07-04).
const STACK_PADDING = 24;

// Stack fan geometry. Each peek drops PEEK_DROP px lower, is PEEK_REVEAL px
// wider/taller than the card in front of it, and leans PEEK_LEAN degrees
// further off-axis (alternating side) — the lean is what actually reads as
// "a stack of cards" rather than "a card with a shadow shelf under it."
// Safe now specifically because CARD_MAX_HEIGHT bounds how far a lean can
// displace a peek's corners — see STACK_PADDING above.
const PEEK_DROP = 12;
const PEEK_REVEAL = 8;
const PEEK_LEAN = 3;

const byDueTime = (a: TaskItem, b: TaskItem) =>
  a.dueTime < b.dueTime ? -1 : a.dueTime > b.dueTime ? 1 : 0;

// One task's content, shared by the front card, the peek cards behind it,
// and the expanded grid — only how it's wrapped differs per use.
function TaskCardBody({ task }: { task: TaskItem }) {
  const Icon = TYPE_ICON[task.type] ?? ClipboardList;
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          task.isOverdue ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)]" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-xs font-semibold tabular-nums", task.isOverdue ? "text-[var(--hub-red)]" : "text-muted-foreground")}>
          {formatTime(task.dueTime, task.isAllDay)}{task.isOverdue ? " · Overdue" : ""}
        </p>
        <p className="mt-0.5 truncate text-base font-semibold text-foreground">{task.title}</p>
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
  const peeks = pending.slice(1, 3);
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
            <div key="stack" className="flex h-full items-center justify-center" style={{ padding: STACK_PADDING }}>
              <div
                className="relative h-full w-full"
                style={{ maxWidth: CARD_MAX_WIDTH, maxHeight: CARD_MAX_HEIGHT }}
              >
                {/* Peek cards — static depth cue, not interactive. Each is
                    PEEK_REVEAL px wider/taller than the card in front of it
                    (poking out along the sides and bottom), PEEK_DROP px
                    lower, and leans PEEK_LEAN degrees further off-axis
                    (alternating side) than the one above it — safe now
                    because the front card's height is capped (see
                    CARD_MAX_HEIGHT/STACK_PADDING above), so the lean's
                    displacement has a known worst case instead of scaling
                    with however tall the widget happens to be. */}
                {peeks.map((task, i) => (
                  <div
                    key={task.id}
                    aria-hidden
                    className="pointer-events-none absolute rounded-2xl border border-border bg-muted"
                    style={{
                      left: -((i + 1) * PEEK_REVEAL),
                      right: -((i + 1) * PEEK_REVEAL),
                      top: (i + 1) * PEEK_DROP,
                      bottom: -((i + 1) * PEEK_REVEAL),
                      transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (i + 1) * PEEK_LEAN}deg)`,
                      opacity: 1 - i * 0.2,
                      zIndex: 1 - i,
                    }}
                  />
                ))}

                {/* Front card — capped size (see CARD_MAX_WIDTH/HEIGHT),
                    centered in whatever space the widget gives it. */}
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={front.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="relative z-10 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                    style={{ height: `calc(100% - ${peeks.length * PEEK_DROP}px)` }}
                  >
                    {/* Progress bar — inside the card, with real padding
                        around it rather than flush against the card's
                        rounded top edge. */}
                    <div className="p-4 pb-0">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${pct}%`, background: "var(--hub-green)" }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandOpen(true)}
                      className="flex items-center justify-between gap-2 px-4 pt-3 text-xs font-semibold text-muted-foreground transition-colors active:text-foreground"
                    >
                      <span className="tabular-nums">{completedCount}/{total} tasks complete</span>
                      <span className="flex items-center gap-1">
                        View all today
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandOpen(true)}
                      className="flex flex-1 items-start px-4 pt-3 text-left"
                    >
                      <TaskCardBody task={front} />
                    </button>

                    <div className="p-3 pt-0">
                      {completeError && (
                        <p className="mb-2 text-center text-xs font-semibold text-[var(--hub-red)]">
                          {completeError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleFrontAction(front); }}
                        className={cn(
                          "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors active:opacity-90",
                        )}
                        style={{ background: front.type === "information" ? "var(--primary)" : "var(--hub-green)" }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {front.type === "information" ? "Got it" : "Complete"}
                      </button>
                    </div>
                  </motion.div>
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
