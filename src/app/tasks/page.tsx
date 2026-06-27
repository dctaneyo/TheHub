"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, addDays, isToday } from "date-fns";
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
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { SubPageHeader } from "@/components/sub-page-header";
import { taskApplies, fmtTaskTime, type CalTask } from "@/lib/task-calendar";

/**
 * Full Tasks — the dashboard widget's modal already covers "today's
 * checklist" well (that's its whole job). What it deliberately doesn't do,
 * since it's scoped to today by design, is what this route is actually
 * for: browsing any other day (history or upcoming) and filtering by type
 * or priority. Reuses the same taskApplies() rules as the widget/calendar
 * so a given day's task list can't drift between the three.
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
      <SubPageHeader title="Tasks" icon={CheckSquare} currentPath="/tasks">
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
              isToday(selectedDate) ? "text-primary" : "text-foreground"
            )}
          >
            {isToday(selectedDate) ? "Today" : format(selectedDate, "MMM d")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </SubPageHeader>

      {/* Filters */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
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
        <span className="ml-auto text-xs text-muted-foreground">
          {format(selectedDate, "EEEE, MMMM d")}
        </span>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {dayTasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <CheckSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tasks match this day and filters</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {dayTasks.map((task) => {
              const Icon = TYPE_ICON[task.type] ?? ClipboardList;
              const done = task.isCompleted;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {fmtTaskTime(task.dueTime, task.isAllDay)}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm font-semibold",
                      done && "text-[var(--hub-green)] line-through opacity-70",
                      !done && "text-foreground"
                    )}
                  >
                    {task.title}
                  </span>
                  {task.type !== "information" && (
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
