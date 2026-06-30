"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  SprayCan,
  Clock,
  ClipboardList,
  Trash2,
  CheckSquare,
  X,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValueText, SelectContent, SelectItem, createListCollection } from "@/components/ui/select";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { TaskVirtualList } from "./task-virtual-list";
import { TaskFormModal } from "./task-form-modal";
import { TaskListSkeleton } from "@/components/ui/skeleton";
import {
  TASK_TEMPLATES,
  TEMPLATE_CATEGORIES,
} from "./task-manager-types";
import type { Task, Location, TaskTemplate } from "./task-manager-types";
import { parseJsonColumn } from "@/lib/json-column";

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>(TEMPLATE_CATEGORIES[0]);

  // Form initial values for pre-filling from templates or editing
  const [formInitial, setFormInitial] = useState<any>(undefined);

  // Bulk-select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, locsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/locations"),
      ]);
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks);
      }
      if (locsRes.ok) {
        const data = await locsRes.json();
        setLocations(data.locations);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live sync — refresh when any ARL creates/edits/deletes a task
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchData();
    socket.on("task:updated", handler);
    return () => { socket.off("task:updated", handler); };
  }, [socket, fetchData]);

  const openCreate = () => {
    setEditingTask(null);
    setFormInitial(undefined);
    setShowTemplates(false);
    setShowForm(true);
  };

  const applyTemplate = (tpl: TaskTemplate) => {
    setEditingTask(null);
    setFormInitial({
      title: tpl.fields.title,
      description: tpl.fields.description || "",
      type: tpl.fields.type,
      priority: tpl.fields.priority,
      dueTime: tpl.fields.dueTime,
      dueDate: "",
      isRecurring: tpl.fields.isRecurring,
      recurringType: tpl.fields.recurringType,
      recurringDays: tpl.fields.recurringDays || ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      recurringMonthDays: [1],
      biweeklyStart: "this" as const,
      assignMode: "all" as const,
      locationId: "",
      selectedLocationIds: [],
      allowEarlyComplete: tpl.fields.allowEarlyComplete ?? false,
      showInToday: true,
      showIn7Day: true,
      showInCalendar: true,
    });
    setShowTemplates(false);
    setShowForm(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    const rType = task.recurringType || "daily";
    setFormInitial({
      title: task.title,
      description: task.description || "",
      type: task.type,
      priority: task.priority,
      dueTime: task.dueTime,
      dueDate: task.dueDate || "",
      isRecurring: task.isRecurring,
      recurringType: rType,
      recurringDays: rType === "monthly" ? [] : parseJsonColumn<string[]>(task.recurringDays, []),
      recurringMonthDays: rType === "monthly" ? parseJsonColumn<number[]>(task.recurringDays, [1]) : [1],
      biweeklyStart: "this" as const,
      assignMode: task.locationId ? "single" as const : "all" as const,
      locationId: task.locationId || "",
      selectedLocationIds: [],
      allowEarlyComplete: task.allowEarlyComplete ?? false,
      showInToday: task.showInToday ?? true,
      // Keep both in sync — Calendar & 7-Day is now a single toggle
      showIn7Day: (task.showIn7Day ?? true) && (task.showInCalendar ?? true),
      showInCalendar: (task.showInCalendar ?? true) && (task.showIn7Day ?? true),
    });
    setShowForm(true);
  };

  const { dialog, confirm: showConfirm } = useConfirmDialog();

  const handleDelete = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    showConfirm({
      title: "Delete Task",
      description: `Delete ${task?.title ?? "this task"}? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
          if (res.ok) fetchData();
        } catch (err) {
          console.error("Delete task error:", err);
        }
      },
    });
  };

  const handleToggleHidden = async (task: Task) => {
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, isHidden: !task.isHidden }),
      });
      fetchData();
    } catch (err) {
      console.error("Toggle hidden error:", err);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deselectAll = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} task${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-request": "1" },
        body: JSON.stringify({ action: "delete-tasks-bulk", payload: { taskIds: ids } }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setSelectMode(false);
        fetchData();
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  };

  // Bulk completion clearing — moved here from the old ARL Data Management
  // page (now relocated/admin-only for the genuinely destructive
  // operations). This is routine tenant self-service work, not a nuclear
  // option, so it stays in Task Manager under the ARL's own session.
  const clearCompletions = (action: "clear-completions-today" | "clear-completions-week" | "clear-all-completions", label: string) => {
    showConfirm({
      title: label,
      description: "Task completion history will be removed. This cannot be undone.",
      confirmLabel: "Clear",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/tasks/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-hub-request": "1" },
            body: JSON.stringify({ action }),
          });
          if (res.ok) fetchData();
        } catch (err) {
          console.error("Clear completions error:", err);
        }
      },
    });
  };

  const locationOptions = useMemo(() => createListCollection({
    items: [{ value: "all", label: "All Locations" }, ...locations.map((l) => ({ value: l.id, label: l.name }))],
  }), [locations]);

  if (loading) {
    return <TaskListSkeleton />;
  }

  const filteredTasks = filterLocationId === "all"
    ? tasks
    : tasks.filter((t) => t.locationId === filterLocationId || t.locationId === null);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">All Tasks & Reminders</h3>
          <p className="text-xs text-muted-foreground">{filteredTasks.length} of {tasks.length} tasks</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            collection={locationOptions}
            value={[filterLocationId]}
            onValueChange={(d) => setFilterLocationId(d.value[0])}
          >
            <SelectTrigger className="w-auto text-xs py-2">
              <SelectValueText />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.items.map((item) => (
                <SelectItem key={item.value} item={item}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Menu>
            <MenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground active:bg-muted transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Clear completions
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem value="today" onClick={() => clearCompletions("clear-completions-today", "Clear today's completions")}>Today</MenuItem>
              <MenuItem value="week" onClick={() => clearCompletions("clear-completions-week", "Clear this week's completions")}>This week</MenuItem>
              <MenuItem value="all" variant="destructive" onClick={() => clearCompletions("clear-all-completions", "Clear all completions")}>All time</MenuItem>
            </MenuContent>
          </Menu>
          <button
            onClick={toggleSelectMode}
            className={cn(
              "flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
              selectMode
                ? "border-[var(--hub-red)] bg-[var(--hub-red)] text-white"
                : "border-border bg-card text-muted-foreground active:bg-muted"
            )}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {selectMode ? "Done" : "Select"}
          </button>
          <button
            onClick={() => setShowTemplates((t) => !t)}
            className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground active:bg-muted transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Templates
            {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <Button onClick={openCreate} size="sm" className="gap-1 rounded-xl bg-[var(--hub-red)] active:bg-[#c4001f] flex-shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Bulk-action bar — visible when 1+ tasks are selected in Select mode */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-xs font-semibold text-foreground">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors active:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            onClick={deselectAll}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors active:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            Deselect all
          </button>
        </div>
      )}

      {/* Template picker */}
      <AnimatePresence>
        {showTemplates && (
          <div className="overflow-hidden">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--hub-red)]" />
                <h4 className="text-sm font-semibold text-foreground">Task Templates</h4>
                <p className="text-xs text-muted-foreground">Click to pre-fill the form</p>
              </div>
              {/* Category tabs */}
              <div className="mb-3 flex flex-wrap gap-1">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTemplateCategory(cat)}
                    className={cn(
                      "rounded-xl px-3 py-1 text-xs font-semibold transition-colors",
                      templateCategory === cat
                        ? "bg-[var(--hub-red)] text-white"
                        : "bg-muted text-muted-foreground active:bg-muted/80"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Templates for selected category */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TASK_TEMPLATES.filter((t) => t.category === templateCategory).map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 text-left transition-all active:border-[var(--hub-red)]/40 active:bg-[var(--hub-red)]/5 group"
                  >
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-red)]/10 text-[var(--hub-red)]">
                      {tpl.fields.type === "cleaning" ? <SprayCan className="h-4 w-4" /> : tpl.fields.type === "reminder" ? <Clock className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground group-active:text-[var(--hub-red)] transition-colors">{tpl.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{tpl.fields.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{tpl.fields.dueTime}</span>
                        {tpl.fields.isRecurring && <span className="text-xs text-muted-foreground capitalize">{tpl.fields.recurringType}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Task List — Virtualized */}
      <TaskVirtualList
        tasks={filteredTasks}
        locations={locations}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleHidden={handleToggleHidden}
        selectable={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectId}
      />

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <TaskFormModal
            editingTask={editingTask}
            locations={locations}
            onClose={() => { setShowForm(false); setEditingTask(null); }}
            onSaved={fetchData}
            initialValues={formInitial}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog {...dialog} />
    </div>
  );
}
