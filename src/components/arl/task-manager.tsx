"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  CalendarDays,
  Repeat,
  AlertTriangle,
  SprayCan,
  ClipboardList,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueTime: string;
  dueDate: string | null;
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  locationId: string | null;
  isHidden: boolean;
  allowEarlyComplete: boolean;
  showInToday: boolean;
  showIn7Day: boolean;
  showInCalendar: boolean;
  points: number;
  createdAt: string;
}

const RECURRING_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

interface Location {
  id: string;
  name: string;
  storeNumber: string;
}

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const TYPES = [
  { value: "task", label: "Task", icon: ClipboardList },
  { value: "cleaning", label: "Cleaning", icon: SprayCan },
  { value: "reminder", label: "Reminder", icon: Clock },
  { value: "training", label: "Training", icon: Sparkles },
];

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-600" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
];

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("normal");
  const [dueTime, setDueTime] = useState("09:00");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [recurringType, setRecurringType] = useState("daily");
  const [recurringDays, setRecurringDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [recurringMonthDays, setRecurringMonthDays] = useState<number[]>([1]);
  const [biweeklyStart, setBiweeklyStart] = useState<"this" | "next">("this");
  // Location assignment: "all" | "single" | "multiple"
  const [assignMode, setAssignMode] = useState<"all" | "single" | "multiple">("all");
  const [locationId, setLocationId] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [points, setPoints] = useState(10);
  const [allowEarlyComplete, setAllowEarlyComplete] = useState(false);
  const [showInToday, setShowInToday] = useState(true);
  const [showIn7Day, setShowIn7Day] = useState(true);
  const [showInCalendar, setShowInCalendar] = useState(true);

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

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setType("task");
    setPriority("normal");
    setDueTime("09:00");
    setDueDate("");
    setIsRecurring(true);
    setRecurringType("daily");
    setRecurringDays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    setRecurringMonthDays([1]);
    setBiweeklyStart("this");
    setAssignMode("all");
    setLocationId("");
    setSelectedLocationIds([]);
    setPoints(10);
    setAllowEarlyComplete(false);
    setShowInToday(true);
    setShowIn7Day(true);
    setShowInCalendar(true);
    setEditingTask(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setType(task.type);
    setPriority(task.priority);
    setDueTime(task.dueTime);
    setDueDate(task.dueDate || "");
    setIsRecurring(task.isRecurring);
    const rType = task.recurringType || "daily";
    setRecurringType(rType);
    if (rType === "monthly") {
      setRecurringMonthDays(task.recurringDays ? JSON.parse(task.recurringDays) : [1]);
      setRecurringDays([]);
    } else {
      setRecurringDays(task.recurringDays ? JSON.parse(task.recurringDays) : []);
      setRecurringMonthDays([1]);
    }
    if (task.locationId) {
      setAssignMode("single");
      setLocationId(task.locationId);
    } else {
      setAssignMode("all");
      setLocationId("");
    }
    setSelectedLocationIds([]);
    setPoints(task.points);
    setAllowEarlyComplete(task.allowEarlyComplete ?? false);
    setShowInToday(task.showInToday ?? true);
    setShowIn7Day(task.showIn7Day ?? true);
    setShowInCalendar(task.showInCalendar ?? true);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (type !== "reminder" && !dueTime) return;

    const isReminder = type === "reminder";
    const baseBody = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      priority,
      dueTime: isReminder && !dueTime ? "00:00" : dueTime,
      dueDate: isRecurring ? null : (dueDate || null),
      isRecurring,
      recurringType: isRecurring ? recurringType : null,
      recurringDays: isRecurring
        ? recurringType === "monthly"
          ? JSON.stringify(recurringMonthDays)
          : recurringType === "daily"
          ? null
          : JSON.stringify(recurringDays)
        : null,
      biweeklyStart: isRecurring && recurringType === "biweekly" ? biweeklyStart : null,
      points,
      allowEarlyComplete,
      showInToday,
      showIn7Day,
      showInCalendar,
    };

    // Build list of locationIds to save individually
    const locationIds: Array<string | null> =
      assignMode === "all" ? [null]
      : assignMode === "single" ? [locationId || null]
      : selectedLocationIds.length > 0 ? selectedLocationIds
      : [null];

    try {
      if (editingTask) {
        // Single update for edit
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, id: editingTask.id, locationId: locationIds[0] }),
        });
        if (res.ok) { setShowForm(false); resetForm(); fetchData(); }
        return;
      }
      // For create: save one task per location
      await Promise.all(locationIds.map((lid) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, locationId: lid }),
        })
      ));
      setShowForm(false);
      resetForm();
      fetchData();
      return;
    } catch (err) {
      console.error("Save task error:", err);
    }

    // legacy fallback path (unreachable but kept for safety)
    const body = { ...(editingTask ? { id: editingTask.id } : {}), ...baseBody, locationId: locationId || null };
    try {
      const res = await fetch("/api/tasks", {
        method: editingTask ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowForm(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      console.error("Save task error:", err);
    }
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

  const toggleDay = (day: string) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
      </div>
    );
  }

  const isReminder = type === "reminder";

  const filteredTasks = filterLocationId === "all"
    ? tasks
    : tasks.filter((t) => t.locationId === filterLocationId || t.locationId === null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">All Tasks & Reminders</h3>
          <p className="text-xs text-slate-400">{filteredTasks.length} of {tasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterLocationId}
            onChange={(e) => setFilterLocationId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm"
          >
            <option value="all">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks
          .sort((a, b) => a.dueTime.localeCompare(b.dueTime))
          .map((task) => {
            const priorityStyle = PRIORITIES.find((p) => p.value === task.priority);
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{task.title}</span>
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
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{task.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
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
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleToggleHidden(task)}
                    title={task.isHidden ? "Show task" : "Hide task"}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      task.isHidden
                        ? "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    )}
                  >
                    {task.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => openEdit(task)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
      </div>

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingTask ? "Edit Task" : "New Task"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task title..."
                    className="rounded-xl"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Description / Instructions</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Details, notes, or instructions..."
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Type</label>
                  <div className="flex gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                          type === t.value
                            ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Priority</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                          priority === p.value
                            ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date + Time + Points */}
                <div className="flex gap-3">
                  {!isRecurring && (
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Due Date</label>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  )}
                  {!isReminder && (
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Due Time</label>
                      <Input
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  )}
                  <div className="w-24">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Points</label>
                    <Input
                      type="number"
                      value={points}
                      onChange={(e) => setPoints(Number(e.target.value))}
                      min={1}
                      max={100}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {/* Recurring */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded"
                    />
                    Recurring Task
                  </label>
                  {isRecurring && (
                    <>
                      {/* Recurring type selector */}
                      <div className="flex gap-1.5">
                        {RECURRING_TYPES.map((rt) => (
                          <button
                            key={rt.value}
                            onClick={() => setRecurringType(rt.value)}
                            className={cn(
                              "flex-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition-all",
                              recurringType === rt.value
                                ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                                : "border-slate-200 text-slate-500 hover:border-slate-300"
                            )}
                          >
                            {rt.label}
                          </button>
                        ))}
                      </div>

                      {/* Weekly / Biweekly: day-of-week picker */}
                      {(recurringType === "weekly" || recurringType === "biweekly") && (
                        <div>
                          <p className="mb-1.5 text-[11px] text-slate-400">
                            {recurringType === "biweekly" ? "Repeats every other week on:" : "Repeats on:"}
                          </p>
                          <div className="flex gap-1.5">
                            {DAYS.map((d) => (
                              <button
                                key={d.key}
                                onClick={() => toggleDay(d.key)}
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold transition-all",
                                  recurringDays.includes(d.key)
                                    ? "bg-[var(--hub-red)] text-white"
                                    : "bg-slate-100 text-slate-400"
                                )}
                              >
                                {d.label.charAt(0)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Biweekly: start week selection */}
                      {recurringType === "biweekly" && (
                        <div>
                          <p className="mb-1.5 text-[11px] text-slate-400">First occurrence:</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setBiweeklyStart("this")}
                              className={cn(
                                "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                                biweeklyStart === "this"
                                  ? "bg-[var(--hub-red)] text-white"
                                  : "bg-slate-100 text-slate-400"
                              )}
                            >
                              This week
                            </button>
                            <button
                              onClick={() => setBiweeklyStart("next")}
                              className={cn(
                                "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                                biweeklyStart === "next"
                                  ? "bg-[var(--hub-red)] text-white"
                                  : "bg-slate-100 text-slate-400"
                              )}
                            >
                              Next week
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Monthly: day-of-month picker */}
                      {recurringType === "monthly" && (
                        <div>
                          <p className="mb-1.5 text-[11px] text-slate-400">Repeats on day(s) of month:</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <button
                                key={day}
                                onClick={() => setRecurringMonthDays((prev) =>
                                  prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
                                )}
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all",
                                  recurringMonthDays.includes(day)
                                    ? "bg-[var(--hub-red)] text-white"
                                    : "bg-slate-100 text-slate-400"
                                )}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {recurringType === "daily" && (
                        <p className="text-[11px] text-slate-400">Repeats every day.</p>
                      )}
                    </>
                  )}
                </div>

                {/* Location Assignment */}
                <div className="space-y-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Assign to</label>
                  <div className="flex gap-2">
                    {(["all", "single", "multiple"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setAssignMode(mode)}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-all",
                          assignMode === mode
                            ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        {mode === "all" ? "All Locations" : mode === "single" ? "One Location" : "Multiple"}
                      </button>
                    ))}
                  </div>
                  {assignMode === "single" && (
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select a location...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name} (#{loc.storeNumber})</option>
                      ))}
                    </select>
                  )}
                  {assignMode === "multiple" && (
                    <div className="flex flex-wrap gap-2">
                      {locations.map((loc) => (
                        <button
                          key={loc.id}
                          onClick={() => setSelectedLocationIds((prev) =>
                            prev.includes(loc.id) ? prev.filter((id) => id !== loc.id) : [...prev, loc.id]
                          )}
                          className={cn(
                            "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                            selectedLocationIds.includes(loc.id)
                              ? "border-[var(--hub-red)] bg-red-50 text-[var(--hub-red)]"
                              : "border-slate-200 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {assignMode === "multiple" && selectedLocationIds.length > 0 && !editingTask && (
                    <p className="text-[11px] text-slate-400">
                      Will create {selectedLocationIds.length} separate task{selectedLocationIds.length > 1 ? "s" : ""}, one per location.
                    </p>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Options</p>

                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowEarlyComplete}
                      onChange={(e) => setAllowEarlyComplete(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-medium">Allow early completion</span>
                    <span className="text-[10px] text-slate-400">(can be completed before due date)</span>
                  </label>

                  <div>
                    <p className="mb-1.5 text-[11px] text-slate-400">Show this task in:</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: "showInToday", label: "Today's Tasks", value: showInToday, set: setShowInToday },
                        { key: "showIn7Day", label: "7-Day View", value: showIn7Day, set: setShowIn7Day },
                        { key: "showInCalendar", label: "Calendar", value: showInCalendar, set: setShowInCalendar },
                      ] as const).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => opt.set(!opt.value)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                            opt.value
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-400"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {(!showInToday || !showIn7Day || !showInCalendar) && (
                      <p className="mt-1 text-[10px] text-amber-600">
                        Hidden from: {[!showInToday && "Today's Tasks", !showIn7Day && "7-Day View", !showInCalendar && "Calendar"].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => setShowForm(false)}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
                    disabled={!title.trim()}
                  >
                    {editingTask ? "Update Task" : "Create Task"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
