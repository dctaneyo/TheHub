"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ClipboardList,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Clock,
  SprayCan,
  Repeat,
} from "@/lib/icons";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { Select, SelectTrigger, SelectValueText, SelectContent, SelectItem, createListCollection } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { IconTip } from "@/components/ui/icon-tip";
import { cn } from "@/lib/utils";
import { taskAppliesToDate } from "@/lib/task-utils";

interface CalTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueTime: string;
  dueDate: string | null;
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  locationId: string | null;
  createdAt?: string;
  biweeklyStart?: string;
  showInCalendar?: boolean;
}

const CAL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAL_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const calTypeIcons: Record<string, typeof ClipboardList> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
};

// Thin adapter over task-utils.ts's taskAppliesToDate — this used to be its
// own independent reimplementation of the recurrence math (a third copy,
// alongside task-utils.ts and task-calendar.ts), exactly the kind of drift
// that's now consolidated to one canonical, tested implementation.
function calTaskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = CAL_DAY_KEYS[date.getDay()];
  // false = no visibility gating — the calendar shows every task due on
  // this date, not just the ones flagged to show in dashboard views.
  return taskAppliesToDate(task, date, dateStr, dayKey, false);
}

function calTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function ArlCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; storeNumber: string }>>([]);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/tasks"), fetch("/api/locations")]).then(async ([tr, lr]) => {
      if (tr.ok) { const d = await tr.json(); setTasks(d.tasks || []); }
      if (lr.ok) { const d = await lr.json(); setLocations(d.locations || []); }
      setLoading(false);
    });
  }, []);

  const filteredTasks = filterLocationId === "all"
    ? tasks
    : tasks.filter((t) => t.locationId === null || t.locationId === filterLocationId);

  const locationOptions = useMemo(() => createListCollection({
    items: [{ value: "all", label: "All Locations" }, ...locations.map((l) => ({ value: l.id, label: `${l.name} (#${l.storeNumber})` }))],
  }), [locations]);

  const getTasksForDate = (date: Date) =>
    filteredTasks
      .filter((t) => t.showInCalendar !== false && calTaskApplies(t, date))
      .sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const monthStart = startOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(currentMonth));
  const weeks: Date[][] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  }

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* Location filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-muted-foreground shrink-0">Filter by location:</label>
        <Select
          collection={locationOptions}
          value={[filterLocationId]}
          onValueChange={(d) => setFilterLocationId(d.value[0])}
        >
          <SelectTrigger className="w-auto text-sm">
            <SelectValueText />
          </SelectTrigger>
          <SelectContent>
            {locationOptions.items.map((item) => (
              <SelectItem key={item.value} item={item}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden flex-col md:flex-row">
        {/* Calendar grid */}
        <Card className="flex flex-1 flex-col gap-0 overflow-hidden rounded-2xl py-0 min-w-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <IconTip label="Previous month">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:bg-muted" title="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            </IconTip>
            <h2 className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
            <IconTip label="Next month">
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:bg-muted" title="Next month"><ChevronRight className="h-4 w-4" /></button>
            </IconTip>
          </div>
          <div className="grid grid-cols-7 border-b border-border min-w-[280px]">
            {CAL_DAYS.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid flex-1 grid-cols-7 border-b border-border last:border-0" style={{ minHeight: 0 }}>
                {week.map((date) => {
                  const dayTasks = getTasksForDate(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const inMonth = isSameMonth(date, currentMonth);
                  return (
                    <div key={date.toISOString()} role="button" tabIndex={0}
                      onClick={() => setSelectedDate(date)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedDate(date)}
                      className={cn("flex flex-col items-start justify-start border-r border-border p-2 text-left transition-colors last:border-0 cursor-pointer overflow-hidden",
                        !inMonth && "bg-muted/50",
                        isSelected && "bg-muted/50",
                        inMonth && !isSelected && "active:bg-muted/50"
                      )}>
                      {/* Selected day gets the same solid-fill treatment as
                          "today" (Section 10 — selected = solid inverted
                          fill, not a tint/ring on the whole cell, which
                          would clash with the task pills nested inside). */}
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isToday(date) ? "bg-[var(--hub-red)] text-white" : isSelected ? "bg-foreground text-background" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                      )}>{format(date, "d")}</span>
                      <div className="mt-1 w-full space-y-1 overflow-hidden">
                        {dayTasks.slice(0, 2).map((task) => {
                          const Icon = calTypeIcons[task.type] || ClipboardList;
                          return (
                            <div key={task.id} className={cn("flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-semibold",
                              task.priority === "urgent" ? "bg-red-500/10 text-red-700 dark:text-red-400" : task.priority === "high" ? "bg-orange-500/10 text-orange-700 dark:text-orange-400" :
                              task.type === "cleaning" ? "bg-purple-500/10 text-purple-700 dark:text-purple-400" : task.type === "reminder" ? "bg-sky-500/10 text-sky-700 dark:text-sky-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                            )}>
                              <Icon className="h-2 w-2 shrink-0" /><span className="truncate">{task.title}</span>
                            </div>
                          );
                        })}
                        {dayTasks.length > 2 && <p className="pl-1 text-xs text-muted-foreground">+{dayTasks.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Day detail */}
        <Card className="w-full md:w-[260px] shrink-0 flex flex-col gap-0 overflow-hidden rounded-2xl py-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{selectedDate ? format(selectedDate, "EEE, MMM d") : "Select a day"}</h3>
            <p className="text-xs text-muted-foreground">{selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && <div className="flex h-20 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-[var(--hub-red)]" /></div>}
            {!loading && selectedTasks.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No tasks this day</p>}
            {selectedTasks.map((task) => {
              const Icon = calTypeIcons[task.type] || ClipboardList;
              const loc = locations.find((l) => l.id === task.locationId);
              return (
                <div key={task.id} className={cn("rounded-xl border p-3",
                  task.priority === "urgent" ? "border-red-500/20 bg-red-500/10" : task.priority === "high" ? "border-orange-500/20 bg-orange-500/10" : "border-border bg-muted/50"
                )}>
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                      task.type === "cleaning" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : task.type === "reminder" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    )}><Icon className="h-3 w-3" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{calTime12(task.dueTime)}</span>
                        {task.isRecurring && <span className="flex items-center gap-1"><Repeat className="h-2.5 w-2.5" />Recurring</span>}
                        <span className="text-muted-foreground">{loc ? loc.name : "All locations"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
