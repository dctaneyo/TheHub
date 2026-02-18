"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Sparkles,
  SprayCan,
  ClipboardList,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueTime: string;
  points: number;
  isCompleted: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
}

interface VerticalTimelineProps {
  tasks: TaskItem[];
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  currentTime: string;
}

const typeIcons: Record<string, typeof Clock> = {
  task: ClipboardList,
  cleaning: SprayCan,
  reminder: Clock,
};

const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
  urgent: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  high: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700" },
  normal: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  low: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-600" },
};

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Generate hours from 8AM to 11PM
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 8 to 23

export function VerticalTimeline({ tasks, onComplete, onUncomplete, currentTime }: VerticalTimelineProps) {
  const [currentMinutes, setCurrentMinutes] = useState(0);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate position of current time indicator (0-100%)
  const currentTimePosition = ((currentMinutes - 8 * 60) / (15 * 60)) * 100; // 8AM to 11PM is 15 hours

  // Sort tasks by due time
  const sortedTasks = [...tasks].sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Today's Tasks</h2>
        <div className="text-sm text-slate-500">{formatTime(currentTime)}</div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Hour blocks */}
        <div className="absolute inset-0">
          {HOURS.map((hour) => {
            const hourMinutes = hour * 60;
            const position = ((hourMinutes - 8 * 60) / (15 * 60)) * 100;
            const nextHourPosition = (((hour + 1) * 60 - 8 * 60) / (15 * 60)) * 100;
            const height = nextHourPosition - position;
            
            return (
              <div key={hour} className="absolute left-0 right-0">
                {/* Hour block */}
                <div 
                  className="absolute left-12 right-0 border-l border-r border-slate-100 bg-white"
                  style={{ 
                    top: `${position}%`,
                    height: `${height}%`,
                    borderTop: hour > 8 ? '1px solid rgb(226 232 240)' : 'none',
                    borderBottom: hour < 23 ? '1px solid rgb(226 232 240)' : 'none'
                  }}
                >
                  {/* Time label inside block */}
                  <div className="absolute left-2 top-1 text-xs font-medium text-slate-400">
                    {hour === 12 ? '12PM' : hour < 12 ? `${hour}AM` : `${hour - 12}PM`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current time indicator */}
        {currentTimePosition >= 0 && currentTimePosition <= 100 && (
          <motion.div
            className="absolute left-0 right-0 z-20 flex items-center"
            style={{ top: `${currentTimePosition}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-0.5 w-full bg-red-500" />
            <div className="absolute left-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-lg">
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
            </div>
            <div className="absolute left-14 -translate-y-1/2 rounded bg-red-500 px-2 py-1 text-xs font-medium text-white">
              Now
            </div>
          </motion.div>
        )}

        {/* Tasks - positioned in 1-hour blocks ending at due time */}
        <div className="relative inset-0">
          <AnimatePresence>
            {sortedTasks.map((task) => {
              const Icon = typeIcons[task.type] || ClipboardList;
              const colors = priorityColors[task.priority] || priorityColors.normal;
              const taskMinutes = timeToMinutes(task.dueTime);
              
              // Task takes 1-hour block ending at due time
              const taskStartMinutes = taskMinutes - 60;
              const startPosition = ((taskStartMinutes - 8 * 60) / (15 * 60)) * 100;
              const endPosition = ((taskMinutes - 8 * 60) / (15 * 60)) * 100;
              const height = endPosition - startPosition;
              
              // Check if task is in the past (before current time)
              const isPast = taskMinutes < currentMinutes;
              
              // Only show tasks within 8AM-11PM range
              if (taskStartMinutes < 8 * 60 || taskMinutes > 23 * 60) {
                return null;
              }
              
              return (
                <motion.div
                  key={task.id}
                  className="absolute left-14 right-2 mx-1"
                  style={{ 
                    top: `${startPosition + 0.5}%`,
                    height: `${height - 1}%`,
                    zIndex: task.isCompleted ? 1 : 10
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={cn(
                      "h-full rounded-lg border p-2 shadow-sm transition-all flex flex-col justify-center overflow-hidden",
                      colors.bg,
                      colors.border,
                      task.isCompleted
                        ? "opacity-60"
                        : task.isOverdue
                        ? "bg-red-50 border-red-300"
                        : task.isDueSoon
                        ? "bg-orange-50 border-orange-300"
                        : "",
                      isPast && !task.isCompleted && "bg-slate-50 border-slate-300"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => (task.isCompleted ? onUncomplete(task.id) : onComplete(task.id))}
                        className="mt-0.5 shrink-0 transition-colors"
                      >
                        {task.isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          <p className={cn(
                            "text-sm font-medium truncate",
                            task.isCompleted ? "line-through text-slate-500" : colors.text
                          )}>
                            {task.title}
                          </p>
                        </div>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="h-2.5 w-2.5" />
                          <span>Due: {formatTime(task.dueTime)}</span>
                          <span className="flex items-center gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" />
                            {task.points} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* No tasks message */}
        {sortedTasks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No tasks scheduled for today</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
