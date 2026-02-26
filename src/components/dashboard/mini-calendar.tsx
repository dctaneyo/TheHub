"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { CalendarDays, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpcomingTask {
  id: string;
  title: string;
  dueTime: string;
  type: string;
  priority: string;
  allowEarlyComplete?: boolean;
  isCompleted?: boolean;
}

interface DayData {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: string;
  month: string;
  tasks: UpcomingTask[];
}

interface MiniCalendarProps {
  upcomingTasks?: Record<string, UpcomingTask[]>; // keyed by YYYY-MM-DD
  onEarlyComplete?: (taskId: string, dateStr: string) => void;
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

export function MiniCalendar({ upcomingTasks = {}, onEarlyComplete }: MiniCalendarProps) {
  const [completing, setCompleting] = useState<string | null>(null);
  const days: DayData[] = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i + 1);
      const dateStr = format(date, "yyyy-MM-dd");
      return {
        date,
        dateStr,
        dayName: format(date, "EEE"),
        dayNum: format(date, "d"),
        month: format(date, "MMM"),
        tasks: upcomingTasks[dateStr] || [],
      };
    });
  }, [upcomingTasks]);

  const handleEarlyComplete = async (taskId: string, dateStr: string) => {
    if (completing) return;
    setCompleting(taskId + dateStr);
    try {
      if (onEarlyComplete) onEarlyComplete(taskId, dateStr);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <CalendarDays className="h-4.5 w-4.5 text-[var(--hub-blue)]" />
        <h2 className="text-sm font-bold text-foreground">Upcoming 7 Days</h2>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {days.map((day) => (
          <div
            key={day.dayNum + day.month}
            className={cn(
              "rounded-xl border border-transparent p-2.5 transition-colors",
              day.tasks.length > 0
                ? "border-border bg-card shadow-sm"
                : "bg-muted/30"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Date badge */}
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-muted">
                <span className="text-[10px] font-semibold uppercase leading-none text-muted-foreground">
                  {day.dayName}
                </span>
                <span className="text-sm font-bold leading-tight text-foreground">
                  {day.dayNum}
                </span>
              </div>

              {/* Tasks for this day */}
              <div className="flex-1 min-w-0">
                {day.tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tasks scheduled</p>
                ) : (
                  <div className="space-y-1">
                    {day.tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center gap-1.5">
                        {task.allowEarlyComplete ? (
                          <button
                            onClick={() => !task.isCompleted && handleEarlyComplete(task.id, day.dateStr)}
                            className="shrink-0"
                            title={task.isCompleted ? "Completed early" : "Complete early"}
                          >
                            {task.isCompleted ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Circle className={cn("h-3.5 w-3.5 transition-colors", completing === task.id + day.dateStr ? "text-emerald-400 animate-pulse" : "text-slate-300 hover:text-emerald-400")} />
                            )}
                          </button>
                        ) : (
                          <div
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              priorityDots[task.priority] || priorityDots.normal
                            )}
                          />
                        )}
                        <span className={cn("truncate text-xs font-medium", task.isCompleted ? "text-muted-foreground line-through" : "text-foreground")}>
                          {task.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
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
