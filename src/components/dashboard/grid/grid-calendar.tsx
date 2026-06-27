"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, X, Info } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  taskApplies,
  buildWeeks,
  fmtTaskTime as fmtTime,
  PRIORITY_DOT,
  type CalTask,
} from "@/lib/task-calendar";

/**
 * Month calendar widget for the GRID dashboard.
 *
 * Compact view: navigable mini month grid with today highlighted and
 * coloured dots for days that have tasks. Clicking any day or the month
 * name navigates to the full /calendar route (which renders the exact same
 * CalendarModal layout below, as a page) instead of opening an in-place
 * overlay.
 *
 * Task-applies-to-date logic (taskApplies/buildWeeks/etc) lives in
 * src/lib/task-calendar.ts, shared with the /calendar route — see that
 * file's comment for why.
 */

// ── Compact widget ────────────────────────────────────────────────────────────

export function GridCalendarWidget() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tasks) setTasks(d.tasks); });
  }, []);

  // calTasks is used indirectly via getTasksForDate which applies the filter inline

  const getTasksForDate = (date: Date) =>
    tasks
      .filter((t) => t.showInCalendar !== false && taskApplies(t, date))
      .sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const weeks = useMemo(() => buildWeeks(currentMonth), [currentMonth]);

  // Tapping the month name or a day navigates to the full /calendar route
  // (which renders this same CalendarModal as a page) instead of opening an
  // in-place overlay — same model as Tasks' completion ring.
  const openCalendar = (date?: Date) => {
    if (date) setSelectedDate(date);
    router.push(date ? `/calendar?date=${format(date, "yyyy-MM-dd")}` : "/calendar");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header — icon + month name doubles as the widget's identity and its
          title (more useful here than a static "Calendar" label), with the
          prev/next controls on the same row rather than a separate nav bar
          stacked under a separate title row. */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={() => openCalendar()}
          className="flex items-center gap-2 text-left transition-colors active:text-primary"
        >
          <Calendar className="h-4 w-4 text-[var(--hub-blue)]" />
          <h2 className="text-lg font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid shrink-0 grid-cols-7 px-3">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — fills remaining space, rows divide equally */}
      <div
        className="min-h-0 flex-1 px-3 pb-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
        }}
      >
        {weeks.flat().map((date, idx) => {
          const inMonth = isSameMonth(date, currentMonth);
          const today = isToday(date);
          const selected = isSameDay(date, selectedDate);
          const dayTasks = inMonth ? getTasksForDate(date) : [];
          const hasMore = dayTasks.length > 3;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => openCalendar(date)}
              className={cn(
                "flex flex-col items-center gap-px rounded-lg py-1 transition-colors active:bg-muted/60",
                !inMonth && "pointer-events-none opacity-25",
                selected && inMonth && !today && "bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold leading-none",
                  today && "bg-[var(--hub-red)] font-semibold text-white",
                  !today && "text-foreground",
                )}
              >
                {format(date, "d")}
              </span>
              {/* Task dots — up to 3 + overflow indicator */}
              <div className="flex min-h-[6px] flex-wrap justify-center gap-[2px] px-1">
                {dayTasks.slice(0, 3).map((t, ti) => (
                  <span
                    key={ti}
                    className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.normal)}
                  />
                ))}
                {hasMore && (
                  <span className="text-xs font-semibold leading-none text-muted-foreground">
                    +{dayTasks.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

// ── Full-screen calendar modal ────────────────────────────────────────────────

/**
 * Exported so the /calendar route can reuse the exact same month-grid +
 * selected-day-list layout instead of a second, separately-maintained
 * implementation — see DESIGN.md's User Flow notes on why the previous
 * standalone /calendar page got rebuilt around this. `onClose` is optional:
 * the widget's floating modal passes it (renders the X button); the page
 * route omits it, since the page's own back-to-dashboard header already
 * covers that and a second close affordance would be redundant.
 */
export function CalendarModal({
  selectedDate,
  onSelectDate,
  getTasksForDate,
  onClose,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  getTasksForDate: (d: Date) => CalTask[];
  onClose?: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(
    startOfMonth(selectedDate)
  );
  const weeks = useMemo(() => buildWeeks(currentMonth), [currentMonth]);
  const selectedTasks = useMemo(
    () => getTasksForDate(selectedDate),
    [selectedDate, getTasksForDate]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-center text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Body: calendar + task list */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row">
        {/* Calendar grid */}
        <div className="flex shrink-0 flex-col p-4 md:w-96 md:border-r md:border-border">
          {/* Day labels */}
          <div className="mb-1 grid grid-cols-7">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="grid grid-cols-7 gap-y-1">
            {weeks.flat().map((date, idx) => {
              const inMonth = isSameMonth(date, currentMonth);
              const today = isToday(date);
              const sel = isSameDay(date, selectedDate);
              const dayTasks = inMonth ? getTasksForDate(date) : [];

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectDate(date);
                    // Sync compact widget month if navigated in modal
                  }}
                  disabled={!inMonth}
                  className={cn(
                    "flex flex-col items-center rounded-xl py-1 transition-colors",
                    inMonth && "active:bg-muted/60",
                    !inMonth && "opacity-20",
                    sel && inMonth && "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      today && "bg-[var(--hub-red)] font-semibold text-white",
                      sel && !today && "ring-2 ring-[var(--hub-red)] ring-offset-1",
                      !today && "text-foreground",
                    )}
                  >
                    {format(date, "d")}
                  </span>
                  {/* Dots */}
                  <div className="mt-1 flex min-h-[8px] flex-wrap justify-center gap-[3px]">
                    {dayTasks.slice(0, 4).map((t, ti) => (
                      <span
                        key={ti}
                        className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.normal)}
                      />
                    ))}
                    {dayTasks.length > 4 && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        +{dayTasks.length - 4}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day task list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <h3 className="mb-3 shrink-0 text-lg font-semibold text-foreground">
            {format(selectedDate, "EEEE, MMMM d")}
            {isToday(selectedDate) && (
              <span className="ml-2 rounded-full bg-[var(--hub-red)]/15 px-2 py-1 text-xs font-semibold text-[var(--hub-red)]">
                Today
              </span>
            )}
          </h3>

          {selectedTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tasks this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3"
                >
                  {task.type === "information" ? (
                    <Info className="mt-1 h-4 w-4 shrink-0 text-blue-400" />
                  ) : (
                    <span
                      className={cn(
                        "mt-2 h-2 w-2 shrink-0 rounded-full",
                        PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.normal
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.type}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {fmtTime(task.dueTime, task.isAllDay)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
