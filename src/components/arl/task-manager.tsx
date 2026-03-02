"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  SprayCan,
  Clock,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
      points: tpl.fields.points,
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
      recurringDays: rType === "monthly" ? [] : (task.recurringDays ? JSON.parse(task.recurringDays) : []),
      recurringMonthDays: rType === "monthly" ? (task.recurringDays ? JSON.parse(task.recurringDays) : [1]) : [1],
      biweeklyStart: "this" as const,
      assignMode: task.locationId ? "single" as const : "all" as const,
      locationId: task.locationId || "",
      selectedLocationIds: [],
      points: task.points,
      allowEarlyComplete: task.allowEarlyComplete ?? false,
      showInToday: task.showInToday ?? true,
      showIn7Day: task.showIn7Day ?? true,
      showInCalendar: task.showInCalendar ?? true,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Delete task error:", err);
    }
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
          <h3 className="text-base font-bold text-foreground">All Tasks & Reminders</h3>
          <p className="text-xs text-muted-foreground">{filteredTasks.length} of {tasks.length} tasks</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterLocationId}
            onChange={(e) => setFilterLocationId(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-sm"
          >
            <option value="all">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowTemplates((t) => !t)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Templates
            {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f] flex-shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Template picker */}
      <AnimatePresence>
        {showTemplates && (
          <div className="overflow-hidden">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--hub-red)]" />
                <h4 className="text-sm font-bold text-foreground">Task Templates</h4>
                <p className="text-xs text-muted-foreground">Click to pre-fill the form</p>
              </div>
              {/* Category tabs */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTemplateCategory(cat)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                      templateCategory === cat
                        ? "bg-[var(--hub-red)] text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-[var(--hub-red)]/40 hover:bg-[var(--hub-red)]/5 group"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-red)]/10 text-[var(--hub-red)]">
                      {tpl.fields.type === "cleaning" ? <SprayCan className="h-4 w-4" /> : tpl.fields.type === "reminder" ? <Clock className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-[var(--hub-red)] transition-colors">{tpl.label}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{tpl.fields.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{tpl.fields.dueTime}</span>
                        <span className="text-[10px] font-medium text-amber-600">{tpl.fields.points} pts</span>
                        {tpl.fields.isRecurring && <span className="text-[10px] text-muted-foreground capitalize">{tpl.fields.recurringType}</span>}
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
    </div>
  );
}
