"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Check } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { UpcomingTask } from "./widget-data";

/**
 * Upcoming widget for the GRID dashboard only — a single flat, chronological
 * list of every task due within the next 7 days (space-saving) instead of the
 * day-by-day breakdown used by <MiniCalendar> on the classic route.
 *
 * Visibility logic is unchanged: `upcomingTasks` is already filtered server-side
 * (tasks configured to be hidden from the upcoming/calendar view never appear
 * in this record), so flattening it preserves that behaviour.
 */

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const priorityDots: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "bg-blue-500",
  low: "bg-slate-400",
};

interface FlatItem {
  dateStr: string;
  date: Date;
  task: UpcomingTask;
}

export function GridUpcomingWidget({
  upcomingTasks = {},
  onEarlyComplete,
  onEarlyUncomplete,
}: {
  upcomingTasks?: Record<string, UpcomingTask[]>;
  onEarlyComplete?: (taskId: string, dateStr: string) => void;
  onEarlyUncomplete?: (taskId: string, dateStr: string) => void;
}) {
  const [completing, setCompleting] = useState<string | null>(null);

  const items: FlatItem[] = useMemo(() => {
    const flat: FlatItem[] = [];
    for (const [dateStr, tasks] of Object.entries(upcomingTasks)) {
      for (const task of tasks) {
        flat.push({ dateStr, date: new Date(`${dateStr}T00:00:00`), task });
      }
    }
    flat.sort((a, b) =>
      a.dateStr !== b.dateStr
        ? a.dateStr < b.dateStr
          ? -1
          : 1
        : a.task.dueTime < b.task.dueTime
          ? -1
          : a.task.dueTime > b.task.dueTime
            ? 1
            : 0
    );
    return flat;
  }, [upcomingTasks]);

  const handleEarlyComplete = async (taskId: string, dateStr: string) => {
    if (completing) return;
    setCompleting(taskId + dateStr);
    try {
      onEarlyComplete?.(taskId, dateStr);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-2 px-3 pt-3">
        <CalendarDays className="h-4 w-4 text-[var(--hub-blue)]" />
        <h2 className="text-base font-bold text-foreground">Upcoming 7 Days</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-base text-muted-foreground">
              Nothing scheduled in the next 7 days
            </p>
          </div>
        ) : (
          items.map(({ dateStr, date, task }) => (
            <div
              key={`${dateStr}-${task.id}`}
              className="flex items-center gap-2.5 border-b border-border/40 px-1.5 py-2.5"
            >
              {/* Date badge */}
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
                <span className="text-xs font-semibold uppercase leading-none text-muted-foreground">
                  {format(date, "EEE")}
                </span>
                <span className="text-base font-bold leading-tight text-foreground">
                  {format(date, "d")}
                </span>
              </div>

              {/* Early-complete control or priority dot */}
              {task.allowEarlyComplete ? (
                <button
                  type="button"
                  onClick={() =>
                    task.isCompleted
                      ? onEarlyUncomplete?.(task.id, dateStr)
                      : handleEarlyComplete(task.id, dateStr)
                  }
                  className="group/cb flex h-11 w-11 shrink-0 items-center justify-center"
                  title={
                    task.isCompleted
                      ? "Undo — mark as not complete"
                      : "Complete early"
                  }
                >
                  {task.isCompleted ? (
                    <CheckCircle2 className="h-7 w-7 text-emerald-500 transition-colors group-hover/cb:text-[var(--hub-red)] group-active/cb:text-[var(--hub-red)]" />
                  ) : (
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
                      completing === task.id + dateStr
                        ? "animate-pulse border-emerald-400 bg-emerald-400/10"
                        : "border-muted-foreground/30 group-hover/cb:border-[var(--hub-green)] group-hover/cb:bg-[var(--hub-green)]/10 group-active/cb:border-[var(--hub-green)] group-active/cb:bg-[var(--hub-green)]/10"
                    )}>
                      <Check className={cn(
                        "h-4 w-4 text-[var(--hub-green)] transition-opacity",
                        completing === task.id + dateStr
                          ? "opacity-100"
                          : "opacity-0 group-hover/cb:opacity-100 group-active/cb:opacity-100"
                      )} />
                    </span>
                  )}
                </button>
              ) : (
                <div
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    priorityDots[task.priority] || priorityDots.normal
                  )}
                />
              )}

              {/* Title */}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-base font-semibold",
                  task.isCompleted
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                )}
              >
                {task.title}
              </span>

              {/* Time */}
              <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                {formatTime12(task.dueTime)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
