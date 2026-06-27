"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, addDays, isToday, isAfter, isBefore, startOfDay } from "date-fns";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Info,
  SprayCan,
  Clock,
  ClipboardList,
  Filter,
  XCircle,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import { taskApplies, fmtTaskTime, type CalTask } from "@/lib/task-calendar";

/**
 * Full Tasks — the dashboard widget's modal already covers "today's
 * checklist" well (that's its whole job). What it deliberately doesn't do,
 * since it's scoped to today by design, is what this route is actually
 * for: browsing any other day (history or upcoming) and filtering by type
 * or priority. Reuses the same taskApplies() rules as the widget/calendar
 * so a given day's task list can't drift between the three.
 *
 * Completion is only possible for today (or a future day if the task is
 * explicitly marked allowEarlyComplete, same rule as the Upcoming widget's
 * "complete early"). Past days are locked — these are recurring tasks, not
 * one-off records, so a missed day stays missed rather than being
 * retroactively edited. The server enforces this too (see
 * /api/tasks/complete and /api/tasks/uncomplete); the UI just reflects it
 * instead of offering a control that would 403.
 */

interface Completion {
  taskId: string;
  completedDate: string;
}

const TYPE_ICON: Record<string, typeof ClipboardList> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
  information: Info,
};

const TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "task", label: "Task" },
  { value: "cleaning", label: "Cleaning" },
  { value: "reminder", label: "Reminder" },
  { value: "information", label: "Information" },
];

const PRIORITY_FILTERS = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  normal: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  low: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, completionsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/tasks/completions"),
      ]);
      if (tasksRes.ok) setTasks((await tasksRes.json()).tasks || []);
      if (completionsRes.ok) setCompletions((await completionsRes.json()).completions || []);
    } catch { /* keep last-known data */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const today = startOfDay(new Date());
  const selectedIsToday = isToday(selectedDate);
  const selectedIsPast = isBefore(startOfDay(selectedDate), today);
  const selectedIsFuture = isAfter(startOfDay(selectedDate), today);

  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => taskApplies(t, selectedDate))
      .filter((t) => typeFilter === "all" || t.type === typeFilter)
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .map((t) => ({
        ...t,
        isCompleted: completions.some((c) => c.taskId === t.id && c.completedDate === dateStr),
      }))
      .sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  }, [tasks, completions, selectedDate, dateStr, typeFilter, priorityFilter]);

  const { actionableCount, completedCount } = useMemo(() => {
    const actionable = dayTasks.filter((t) => t.type !== "information");
    return {
      actionableCount: actionable.length,
      completedCount: actionable.filter((t) => t.isCompleted).length,
    };
  }, [dayTasks]);

  const toggleComplete = async (taskId: string, currentlyDone: boolean) => {
    if (busyId) return;
    setBusyId(taskId);
    try {
      await fetch(`/api/tasks/${currentlyDone ? "uncomplete" : "complete"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, localDate: dateStr }),
      });
      await fetchAll();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader title="Tasks" icon={CheckSquare} backHref="/dashboard" currentPath="/tasks">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card px-1">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(new Date())}
            className={cn(
              "px-2 text-xs font-semibold transition-colors",
              selectedIsToday ? "text-primary" : "text-foreground"
            )}
          >
            {selectedIsToday ? "Today" : format(selectedDate, "MMM d")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </AppHeader>

      {/* Filters + day summary */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            {TYPE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            {PRIORITY_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="font-semibold text-foreground">{format(selectedDate, "EEEE, MMMM d")}</span>
          {actionableCount > 0 && (
            <span className="font-semibold tabular-nums text-muted-foreground">
              {completedCount}/{actionableCount} complete
            </span>
          )}
          {selectedIsPast && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Past — read only
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {dayTasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <CheckSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tasks match this day and filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {dayTasks.map((task) => {
              const Icon = TYPE_ICON[task.type] ?? ClipboardList;
              const done = task.isCompleted;
              const isInformation = task.type === "information";
              const canEarlyComplete = selectedIsFuture && !!task.allowEarlyComplete;
              const canToggle = selectedIsToday || canEarlyComplete;
              const missed = selectedIsPast && !done && !isInformation;

              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {task.type}
                    </span>
                    {!isInformation && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.normal
                        )}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          done && "text-[var(--hub-green)] line-through opacity-70",
                          !done && "text-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        {fmtTaskTime(task.dueTime, task.isAllDay)}
                      </p>
                    </div>

                    {!isInformation && canToggle && (
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => toggleComplete(task.id, done)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center disabled:opacity-50"
                      >
                        <CheckCircle2
                          className={cn(
                            "h-6 w-6 transition-colors",
                            done ? "text-[var(--hub-green)]" : "text-muted-foreground/25"
                          )}
                        />
                      </button>
                    )}

                    {!isInformation && !canToggle && (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center" title={missed ? "Missed — that day has passed" : "Not completable yet"}>
                        {missed ? (
                          <XCircle className="h-6 w-6 text-[var(--hub-red)]/60" />
                        ) : done ? (
                          <CheckCircle2 className="h-6 w-6 text-[var(--hub-green)]" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-muted-foreground/15" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
