"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, X, Info } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Month calendar widget for the GRID dashboard.
 *
 * Compact view: navigable mini month grid with today highlighted and
 * coloured dots for days that have tasks. Clicking any day or the month
 * header opens a fullscreen modal with the full grid + a per-day task list.
 */

// ── Types ────────────────────────────────────────────────────────────────────

interface CalTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueTime: string;
  isAllDay?: boolean;
  dueDate: string | null;
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  biweeklyStart?: string | null;
  locationId: string | null;
  createdAt?: string;
  showInCalendar?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function taskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = DAY_KEYS[date.getDay()];
  if (task.createdAt) {
    const created = task.createdAt.split("T")[0];
    if (dateStr < created) return false;
  }
  if (!task.isRecurring) return task.dueDate === dateStr;
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") {
    try { return (JSON.parse(task.recurringDays!) as string[]).includes(dayKey); } catch { return false; }
  }
  if (rType === "biweekly") {
    try {
      const days = JSON.parse(task.recurringDays!) as string[];
      if (!days.includes(dayKey)) return false;
      const anchor = task.createdAt ? new Date(task.createdAt) : new Date(0);
      const anchorDay = anchor.getDay();
      const anchorMon = new Date(anchor);
      anchorMon.setDate(anchor.getDate() + (anchorDay === 0 ? -6 : 1 - anchorDay));
      anchorMon.setHours(0, 0, 0, 0);
      const targetDay = date.getDay();
      const targetMon = new Date(date);
      targetMon.setDate(date.getDate() + (targetDay === 0 ? -6 : 1 - targetDay));
      targetMon.setHours(0, 0, 0, 0);
      const weeksDiff = Math.round((targetMon.getTime() - anchorMon.getTime()) / (7 * 86400000));
      const isEven = weeksDiff % 2 === 0;
      return task.biweeklyStart === "next" ? !isEven : isEven;
    } catch { return false; }
  }
  if (rType === "monthly") {
    try { return (JSON.parse(task.recurringDays!) as number[]).includes(date.getDate()); } catch { return false; }
  }
  return false;
}

function fmtTime(t: string, allDay?: boolean) {
  if (allDay) return "All Day";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  normal: "bg-blue-400",
  low: "bg-slate-400",
};

// ── Month grid builder ────────────────────────────────────────────────────────

function buildWeeks(month: Date): Date[][] {
  const weeks: Date[][] = [];
  let day = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  while (day <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  }
  return weeks;
}

// ── Compact widget ────────────────────────────────────────────────────────────

export function GridCalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

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

  const openModal = (date?: Date) => {
    if (date) setSelectedDate(date);
    setModalOpen(true);
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
          onClick={() => openModal()}
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
              onClick={() => openModal(date)}
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

      {/* Fullscreen modal */}
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
              <CalendarModal
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                getTasksForDate={getTasksForDate}
                onClose={() => setModalOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Full-screen calendar modal ────────────────────────────────────────────────

function CalendarModal({
  selectedDate,
  onSelectDate,
  getTasksForDate,
  onClose,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  getTasksForDate: (d: Date) => CalTask[];
  onClose: () => void;
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
        <button
          type="button"
          onClick={onClose}
          className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
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
              <span className="text-4xl">📅</span>
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
