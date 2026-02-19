"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  ClipboardList,
  SprayCan,
  CalendarDays,
  Repeat,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
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

interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueTime: string;
  dueDate: string | null;
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  points: number;
  locationId: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const typeIcons: Record<string, typeof ClipboardList> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
};

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  normal: "bg-blue-400",
  low: "bg-slate-300",
};

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function taskAppliesToDate(task: Task, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = DAY_KEYS[date.getDay()];
  if (!task.isRecurring) return task.dueDate === dateStr;
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as string[]).includes(dayKey); } catch { return false; }
  }
  if (rType === "biweekly") {
    if (!task.recurringDays) return false;
    try {
      const days = JSON.parse(task.recurringDays) as string[];
      if (!days.includes(dayKey)) return false;
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      return weekNum % 2 === 0;
    } catch { return false; }
  }
  if (rType === "monthly") {
    if (!task.recurringDays) return false;
    try { return (JSON.parse(task.recurringDays) as number[]).includes(date.getDate()); } catch { return false; }
  }
  return false;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const endpoint = user?.userType === "arl" ? "/api/tasks" : "/api/tasks";
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const getTasksForDate = (date: Date) =>
    tasks.filter((t) => taskAppliesToDate(t, date)).sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const weeks: Date[][] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)] shadow-sm">
            <span className="text-sm font-black text-white">H</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Full Calendar</h1>
            <p className="text-[10px] text-slate-400">{user?.name}</p>
          </div>
        </div>
        <button
          onClick={() => window.history.back()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          {/* Month nav */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-bold text-slate-800">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex flex-1 flex-col">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid flex-1 grid-cols-7 border-b border-slate-100 last:border-0" style={{ minHeight: 0 }}>
                {week.map((date) => {
                  const dayTasks = getTasksForDate(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const inMonth = isSameMonth(date, currentMonth);
                  const todayDate = isToday(date);

                  return (
                    <div
                      key={date.toISOString()}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDate(date)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedDate(date)}
                      className={cn(
                        "flex flex-col items-start justify-start border-r border-slate-100 p-1.5 text-left transition-colors last:border-0 overflow-hidden cursor-pointer",
                        !inMonth && "bg-slate-50/50",
                        isSelected && "bg-[var(--hub-red)]/5 ring-1 ring-inset ring-[var(--hub-red)]/20",
                        inMonth && !isSelected && "hover:bg-slate-50"
                      )}
                    >
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        todayDate ? "bg-[var(--hub-red)] text-white" : inMonth ? "text-slate-700" : "text-slate-300"
                      )}>
                        {format(date, "d")}
                      </span>
                      <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                        {dayTasks.map((task) => {
                          const Icon = typeIcons[task.type] || ClipboardList;
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium truncate",
                                task.priority === "urgent" ? "bg-red-100 text-red-700" :
                                task.priority === "high" ? "bg-orange-100 text-orange-700" :
                                task.type === "cleaning" ? "bg-purple-100 text-purple-700" :
                                task.type === "reminder" ? "bg-sky-100 text-sky-700" :
                                "bg-blue-100 text-blue-700"
                              )}
                            >
                              <Icon className="h-2 w-2 shrink-0" />
                              <span className="truncate">{task.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="w-[300px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-800">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a day"}
            </h3>
            <p className="text-[10px] text-slate-400">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading && (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
              </div>
            )}
            {!loading && selectedTasks.length === 0 && (
              <div className="flex h-32 items-center justify-center">
                <div className="text-center">
                  <CalendarDays className="mx-auto h-7 w-7 text-slate-200" />
                  <p className="mt-2 text-xs text-slate-400">No tasks this day</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {selectedTasks.map((task, i) => {
                const Icon = typeIcons[task.type] || ClipboardList;
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      "rounded-xl border p-3",
                      task.priority === "urgent" ? "border-red-200 bg-red-50" :
                      task.priority === "high" ? "border-orange-200 bg-orange-50" :
                      "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        task.type === "cleaning" ? "bg-purple-100 text-purple-600" :
                        task.type === "reminder" ? "bg-sky-100 text-sky-600" :
                        "bg-blue-100 text-blue-600"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{task.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTime12(task.dueTime)}
                          </span>
                          {task.isRecurring && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Repeat className="h-2.5 w-2.5" />
                              Recurring
                            </span>
                          )}
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            priorityDot[task.priority] || priorityDot.normal
                          )} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
