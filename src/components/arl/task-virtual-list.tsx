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
  MoreVertical,
  CheckSquare,
  Square,
} from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { PRIORITIES, formatTime12 } from "./task-manager-types";
import type { Task, Location } from "./task-manager-types";

interface TaskVirtualListProps {
  tasks: Task[];
  locations: Location[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (task: Task) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const GRID_COLS = "minmax(0,1fr) 220px 72px auto";

export function TaskVirtualList({ tasks, locations, onEdit, onDelete, onToggleHidden, selectable, selectedIds, onToggleSelect }: TaskVirtualListProps) {
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.dueTime.localeCompare(b.dueTime)), [tasks]);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    gap: 0,
    overscan: 5,
  });

  const gridCols = selectable ? `32px ${GRID_COLS}` : GRID_COLS;

  if (sorted.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No tasks match your filter.</div>;
  }

  return (
    // Desktop: one continuous rounded-card surface (header + rows), matching
    // the table convention used by locations-manager.tsx/forms-repository.tsx
    // — the virtualizer's row gap is 0 so rows sit flush against each other
    // instead of revealing the page background between them. Mobile keeps
    // its own per-card chrome (no shared wrapper), so the gap moves to a
    // bottom-padding on each row instead of the wrapper.
    <div className="flex flex-col flex-1 min-h-0 md:rounded-2xl md:border md:border-border md:bg-card md:overflow-hidden">
      {/* Desktop column header */}
      <div
        className="hidden md:grid text-xs text-muted-foreground border-b border-border bg-card sticky top-0 z-10"
        style={{ gridTemplateColumns: gridCols }}
      >
        {selectable && <div className="px-3 py-2.5" />}
        <div className="px-4 py-2.5 font-semibold">Task</div>
        <div className="px-4 py-2.5 font-semibold">Schedule</div>
        <div className="px-4 py-2.5 font-semibold text-right">Points</div>
        <div className="px-4 py-2.5 font-semibold text-right">Actions</div>
      </div>

      <div ref={parentRef} className="overflow-y-auto flex-1 min-h-0">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const task = sorted[vRow.index];
            const priorityStyle = PRIORITIES.find((p) => p.value === task.priority);
            return (
              <div
                key={task.id}
                data-index={vRow.index}
                ref={virtualizer.measureElement}
                className="pb-2 md:pb-0"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
              >
                {/* Desktop grid row */}
                <div
                  className="hidden md:grid items-center border-b border-border bg-card"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  {selectable && (
                    <div className="px-3 py-2.5 flex items-center justify-center">
                      <button
                        onClick={() => onToggleSelect?.(task.id)}
                        className="flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors"
                        aria-label={selectedIds?.has(task.id) ? "Deselect task" : "Select task"}
                      >
                        {selectedIds?.has(task.id)
                          ? <CheckSquare className="h-4 w-4 text-[var(--hub-red)]" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                  {/* Task column — Type/Priority are finite-vocabulary fields, so
                      they live here as chips next to the title (Section 11)
                      rather than in their own mostly-empty columns; Recurring
                      lives only in the Schedule column to avoid showing the
                      same fact twice in one row (Section 18). */}
                  <div className="px-4 py-2.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{task.title}</span>
                      <Badge variant="secondary" className={cn("text-xs", priorityStyle?.color)}>
                        {task.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {task.type}
                      </Badge>
                      {task.allowEarlyComplete && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          Early OK
                        </Badge>
                      )}
                      {(!task.showInToday || !task.showInCalendar) && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          {[!task.showInToday && "Today", !task.showInCalendar && "Cal/7-Day"].filter(Boolean).join("/")} hidden
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
                    )}
                  </div>
                  {/* Schedule column */}
                  <div className="px-4 py-2.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {!task.isRecurring && task.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.isRecurring && (
                      <span className="flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        Recurring
                      </span>
                    )}
                    {task.type !== "reminder" && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime12(task.dueTime)}
                      </span>
                    )}
                    <span>
                      {task.locationId
                        ? locations.find((l) => l.id === task.locationId)?.name || "Specific location"
                        : "All locations"}
                    </span>
                  </div>
                  {/* Points column — its own slot, right-aligned, so values
                      are scannable/comparable across rows (Section 11)
                      instead of sitting inline among unrelated facts. */}
                  <div className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                    {task.points}
                  </div>
                  {/* Actions column */}
                  <div className="px-4 py-2.5 flex items-center gap-1">
                    <button
                      onClick={() => onToggleHidden(task)}
                      title={task.isHidden ? "Show task" : "Hide task"}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                        task.isHidden
                          ? "bg-muted text-muted-foreground active:bg-muted/80"
                          : "text-muted-foreground active:bg-muted active:text-foreground"
                      )}
                    >
                      {task.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => onEdit(task)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted active:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <Menu>
                      <MenuTrigger className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors active:bg-muted active:text-foreground">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem value="delete" variant="destructive" onClick={() => onDelete(task.id)}>
                          <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete Task
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="md:hidden flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  {selectable && (
                    <button
                      onClick={() => onToggleSelect?.(task.id)}
                      className="shrink-0 self-center flex items-center justify-center text-muted-foreground transition-colors"
                      aria-label={selectedIds?.has(task.id) ? "Deselect task" : "Select task"}
                    >
                      {selectedIds?.has(task.id)
                        ? <CheckSquare className="h-5 w-5 text-[var(--hub-red)]" />
                        : <Square className="h-5 w-5" />}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{task.title}</span>
                      <Badge variant="secondary" className={cn("text-xs", priorityStyle?.color)}>
                        {task.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {task.type}
                      </Badge>
                      {task.isRecurring && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Repeat className="h-2.5 w-2.5" />
                          Recurring
                        </Badge>
                      )}
                      {task.allowEarlyComplete && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          Early OK
                        </Badge>
                      )}
                      {(!task.showInToday || !task.showInCalendar) && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          {[!task.showInToday && "Today", !task.showInCalendar && "Cal/7-Day"].filter(Boolean).join("/")} hidden
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{task.description}</p>
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
                          ? "bg-muted text-muted-foreground active:bg-muted/80"
                          : "text-muted-foreground active:bg-muted active:text-foreground"
                      )}
                    >
                      {task.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => onEdit(task)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted active:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <Menu>
                      <MenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors active:bg-muted active:text-foreground">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem value="delete" variant="destructive" onClick={() => onDelete(task.id)}>
                          <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete Task
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
