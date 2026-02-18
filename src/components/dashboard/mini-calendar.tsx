"use client";

import { useMemo } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { CalendarDays, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpcomingTask {
  id: string;
  title: string;
  dueTime: string;
  type: string;
  priority: string;
}

interface DayData {
  date: Date;
  dayName: string;
  dayNum: string;
  month: string;
  tasks: UpcomingTask[];
}

interface MiniCalendarProps {
  upcomingTasks?: Record<string, UpcomingTask[]>; // keyed by YYYY-MM-DD
}

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

export function MiniCalendar({ upcomingTasks = {} }: MiniCalendarProps) {
  const days: DayData[] = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i + 1);
      const dateStr = format(date, "yyyy-MM-dd");
      return {
        date,
        dayName: format(date, "EEE"),
        dayNum: format(date, "d"),
        month: format(date, "MMM"),
        tasks: upcomingTasks[dateStr] || [],
      };
    });
  }, [upcomingTasks]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <CalendarDays className="h-4.5 w-4.5 text-[var(--hub-blue)]" />
        <h2 className="text-sm font-bold text-slate-800">Upcoming 7 Days</h2>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {days.map((day) => (
          <div
            key={day.dayNum + day.month}
            className={cn(
              "rounded-xl border border-transparent p-2.5 transition-colors",
              day.tasks.length > 0
                ? "border-slate-200 bg-white shadow-sm"
                : "bg-slate-50/50"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Date badge */}
              <div className="flex h-10 w-10 shrink-0 flex-col items-start justify-start rounded-xl bg-slate-100 p-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">
                  {day.dayName}
                </span>
                <span className="text-sm font-bold leading-none text-slate-800">
                  {day.dayNum}
                </span>
              </div>

              {/* Tasks for this day */}
              <div className="flex-1 min-w-0 mt-0.5">
                {day.tasks.length === 0 ? (
                  <p className="text-xs text-slate-400">No tasks scheduled</p>
                ) : (
                  <div className="space-y-1">
                    {day.tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            priorityDots[task.priority] || priorityDots.normal
                          )}
                        />
                        <span className="truncate text-xs font-medium text-slate-700">
                          {task.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatTime12(task.dueTime)}
                        </span>
                      </div>
                    ))}
                    {day.tasks.length > 3 && (
                      <span className="text-[10px] font-medium text-slate-400">
                        +{day.tasks.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {day.tasks.length > 0 && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--hub-blue)]/10">
                  <span className="text-[10px] font-bold text-[var(--hub-blue)]">
                    {day.tasks.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
