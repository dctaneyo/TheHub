"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Pencil,
  Trash2,
  Repeat,
  CalendarDays,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
} from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRIORITIES, formatTime12 } from "./task-manager-types";
import type { Task, Location } from "./task-manager-types";

interface TaskVirtualListProps {
  tasks: Task[];
  locations: Location[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (task: Task) => void;
}

export function TaskVirtualList({ tasks, locations, onEdit, onDelete, onToggleHidden }: TaskVirtualListProps) {
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.dueTime.localeCompare(b.dueTime)), [tasks]);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    gap: 8,
    overscan: 5,
  });

  if (sorted.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No tasks match your filter.</div>;
  }

  return (
    <div ref={parentRef} className="overflow-y-auto rounded-xl flex-1 min-h-0">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const task = sorted[vRow.index];
          const priorityStyle = PRIORITIES.find((p) => p.value === task.priority);
          return (
            <div
              key={task.id}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{task.title}</span>
                    <Badge variant="secondary" className={cn("text-[10px]", priorityStyle?.color)}>
                      {task.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {task.type}
                    </Badge>
                    {task.isRecurring && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Repeat className="h-2.5 w-2.5" />
                        Recurring
                      </Badge>
                    )}
                    {task.allowEarlyComplete && (
                      <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                        Early OK
                      </Badge>
                    )}
                    {(!task.showInToday || !task.showIn7Day || !task.showInCalendar) && (
                      <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">
                        {[!task.showInToday && "Today", !task.showIn7Day && "7-Day", !task.showInCalendar && "Cal"].filter(Boolean).join("/")} hidden
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {!task.isRecurring && task.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.type !== "reminder" && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime12(task.dueTime)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {task.points} pts
                    </span>
                    {task.locationId ? (
                      <span>
                        {locations.find((l) => l.id === task.locationId)?.name || "Specific location"}
                      </span>
                    ) : (
                      <span>All locations</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 self-start mt-1 sm:mt-0 sm:self-center">
                  <button
                    onClick={() => onToggleHidden(task)}
                    title={task.isHidden ? "Show task" : "Hide task"}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      task.isHidden
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {task.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => onEdit(task)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(task.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
