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

// Animated color transitions
const colorTransitionColors = [
  "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", 
  "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-gray-500"
];

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
  // Derive currentMinutes directly from the prop — the dashboard parent
  // updates currentTime every second so the red line is always in sync.
  const currentMinutes = timeToMinutes(currentTime || "00:00");

  
  // Calculate position of current time indicator (0-100%)
  const currentTimePosition = ((currentMinutes - 8 * 60) / (15 * 60)) * 100; // 8AM to 11PM is 15 hours

  // Sort tasks by due time
  const sortedTasks = [...tasks].sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  // Group tasks by their actual due hour
  const tasksByHour = new Map<number, TaskItem[]>();
  HOURS.forEach(hour => tasksByHour.set(hour, []));
  
  sortedTasks.forEach(task => {
    const taskMinutes = timeToMinutes(task.dueTime);
    const taskHour = Math.floor(taskMinutes / 60);
    
    // Place task in its actual due hour
    if (taskHour >= 8 && taskHour <= 23) {
      const hourTasks = tasksByHour.get(taskHour) || [];
      hourTasks.push(task);
      tasksByHour.set(taskHour, hourTasks);
    }
  });

  // Group tasks within each hour by close due times (within 15 minutes)
  const groupedTasksByHour = new Map<number, TaskItem[][]>();
  tasksByHour.forEach((hourTasks, hour) => {
    const groups: TaskItem[][] = [];
    // Sort tasks by due time within the hour
    const sortedHourTasks = [...hourTasks].sort((a, b) => a.dueTime.localeCompare(b.dueTime));
    
    sortedHourTasks.forEach(task => {
      const taskMinutes = timeToMinutes(task.dueTime);
      const lastGroup = groups[groups.length - 1];
      
      if (lastGroup && lastGroup.length > 0) {
        const lastTaskMinutes = timeToMinutes(lastGroup[0].dueTime);
        // If tasks are within 30 minutes, group them together
        if (Math.abs(taskMinutes - lastTaskMinutes) <= 30) {
          lastGroup.push(task);
        } else {
          groups.push([task]);
        }
      } else {
        groups.push([task]);
      }
    });
    groupedTasksByHour.set(hour, groups);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white overflow-hidden relative">
        {/* Tasks */}
        <div className="absolute inset-0 pointer-events-none">
          {sortedTasks.map((task) => {
            const taskMinutes = timeToMinutes(task.dueTime);
            const taskHour = Math.floor(taskMinutes / 60);
            const hourIndex = taskHour - 8; // 0-based index from 8AM
            const taskPosition = (hourIndex / 15) * 100; // Position within 15-hour timeline
            
            if (taskMinutes < 8 * 60) return null;
            
            const Icon = typeIcons[task.type] || ClipboardList;
            const colors = priorityColors[task.priority] || priorityColors.normal;
            
            return (
              <motion.div
                key={task.id}
                className={cn(
                  "absolute left-12 right-0 rounded border p-1.5 shadow-sm transition-all",
                  colors.bg,
                  colors.border,
                  task.isCompleted && "opacity-60"
                )}
                style={{ 
                  top: `${taskPosition}%`,
                  transform: 'translateY(-50%) translateY(-20px)'
                }}
                animate={task.isDueSoon && !task.isCompleted ? {
                  backgroundColor: colorTransitionColors,
                  transition: { duration: 2, repeat: Infinity, ease: "linear" }
                } : {}}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => (task.isCompleted ? onUncomplete(task.id) : onComplete(task.id))}
                    className="shrink-0 transition-colors"
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                  <Icon className="h-3 w-3 shrink-0 text-slate-500" />
                  <p className={cn(
                    "flex-1 text-xs font-medium truncate",
                    task.isCompleted ? "line-through text-slate-500" : colors.text
                  )}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                    <Clock className="h-2 w-2" />
                    <span>{formatTime(task.dueTime)}</span>
                    <span>{task.points}pts</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline grid */}
        <div className="flex h-full">
          {/* Time labels column */}
          <div className="w-12 flex flex-col border-r border-slate-200">
            {HOURS.map((hour) => (
              <div key={hour} className="flex-1 flex items-start justify-center border-b border-slate-100 pt-1">
                <span className="text-xs font-medium text-slate-400">
                  {hour === 12 ? '12PM' : hour < 12 ? `${hour}AM` : `${hour - 12}PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Timeline background with hour lines */}
          <div className="flex-1 flex flex-col">
            {HOURS.map((hour) => {
              const isPast = hour * 60 < currentMinutes;
              
              return (
                <div 
                  key={hour} 
                  className={cn(
                    "flex-1 border-b-2 border-slate-200",
                    isPast && "bg-slate-50"
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
