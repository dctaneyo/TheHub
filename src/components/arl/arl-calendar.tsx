"use client";

import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";

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

function calTaskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = CAL_DAY_KEYS[date.getDay()];
  if (!task.isRecurring) return task.dueDate === dateStr;
  if (task.createdAt) {
    const createdDateStr = task.createdAt.split("T")[0];
    if (dateStr < createdDateStr) return false;
  }
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") {
    try {
      return (JSON.parse(task.recurringDays!) as string[]).includes(dayKey);
    } catch {
      return false;
    }
  }
  if (rType === "biweekly") {
    try {
      const days = JSON.parse(task.recurringDays!) as string[];
      if (!days.includes(dayKey)) return false;
      const anchorDate = task.createdAt ? new Date(task.createdAt) : new Date(0);
      const anchorDay = anchorDate.getDay();
      const anchorMon = new Date(anchorDate);
      anchorMon.setDate(anchorDate.getDate() + (anchorDay === 0 ? -6 : 1 - anchorDay));
      anchorMon.setHours(0, 0, 0, 0);
      const targetDay = date.getDay();
      const targetMon = new Date(date);
      targetMon.setDate(date.getDate() + (targetDay === 0 ? -6 : 1 - targetDay));
      targetMon.setHours(0, 0, 0, 0);
      const weeksDiff = Math.round(
        (targetMon.getTime() - anchorMon.getTime()) / (7 * 86400000),
      );
      const isEven = weeksDiff % 2 === 0;
      return task.biweeklyStart === "next" ? !isEven : isEven;
    } catch {
      return false;
    }
  }
  if (rType === "monthly") {
    try {
      return (JSON.parse(task.recurringDays!) as number[]).includes(date.getDate());
    } catch {
      return false;
    }
  }
  return false;
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
        <select
          value={filterLocationId}
          onChange={(e) => setFilterLocationId(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm"
        >
          <option value="all">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name} (#{l.storeNumber})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden flex-col md:flex-row">
        {/* Calendar grid */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm min-w-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <h2 className="text-sm font-bold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-border min-w-[280px]">
            {CAL_DAYS.map((d) => <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}
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
                      className={cn("flex flex-col items-start justify-start border-r border-border p-1.5 text-left transition-colors last:border-0 cursor-pointer overflow-hidden",
                        !inMonth && "bg-muted/50",
                        isSelected && "bg-[var(--hub-red)]/5 ring-1 ring-inset ring-[var(--hub-red)]/20",
                        inMonth && !isSelected && "hover:bg-muted/50"
                      )}>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        isToday(date) ? "bg-[var(--hub-red)] text-white" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                      )}>{format(date, "d")}</span>
                      <div className="mt-0.5 w-full space-y-0.5 overflow-hidden">
                        {dayTasks.slice(0, 2).map((task) => {
                          const Icon = calTypeIcons[task.type] || ClipboardList;
                          return (
                            <div key={task.id} className={cn("flex w-full items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium",
                              task.priority === "urgent" ? "bg-red-100 text-red-700" : task.priority === "high" ? "bg-orange-100 text-orange-700" :
                              task.type === "cleaning" ? "bg-purple-100 text-purple-700" : task.type === "reminder" ? "bg-sky-100 text-sky-700" : "bg-blue-100 text-blue-700"
                            )}>
                              <Icon className="h-2 w-2 shrink-0" /><span className="truncate">{task.title}</span>
                            </div>
                          );
                        })}
                        {dayTasks.length > 2 && <p className="pl-0.5 text-[9px] text-muted-foreground">+{dayTasks.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="w-full md:w-[260px] shrink-0 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">{selectedDate ? format(selectedDate, "EEE, MMM d") : "Select a day"}</h3>
            <p className="text-[10px] text-muted-foreground">{selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}</p>
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
                    <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                      task.type === "cleaning" ? "bg-purple-100 text-purple-600" : task.type === "reminder" ? "bg-sky-100 text-sky-600" : "bg-blue-100 text-blue-600"
                    )}><Icon className="h-3 w-3" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{calTime12(task.dueTime)}</span>
                        {task.isRecurring && <span className="flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />Recurring</span>}
                        <span className="text-muted-foreground">{loc ? loc.name : "All locations"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
