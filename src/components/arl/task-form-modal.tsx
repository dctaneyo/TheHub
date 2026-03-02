"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, SprayCan, Clock, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import {
  RECURRING_TYPES,
  DAYS,
  TYPES,
  PRIORITIES,
} from "./task-manager-types";
import type { Task, Location } from "./task-manager-types";

interface TaskFormModalProps {
  editingTask: Task | null;
  locations: Location[];
  onClose: () => void;
  onSaved: () => void;
  initialValues?: {
    title: string;
    description: string;
    type: string;
    priority: string;
    dueTime: string;
    dueDate: string;
    isRecurring: boolean;
    recurringType: string;
    recurringDays: string[];
    recurringMonthDays: number[];
    biweeklyStart: "this" | "next";
    assignMode: "all" | "single" | "multiple";
    locationId: string;
    selectedLocationIds: string[];
    points: number;
    allowEarlyComplete: boolean;
    showInToday: boolean;
    showIn7Day: boolean;
    showInCalendar: boolean;
  };
}

export function TaskFormModal({ editingTask, locations, onClose, onSaved, initialValues }: TaskFormModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [type, setType] = useState(initialValues?.type ?? "task");
  const [priority, setPriority] = useState(initialValues?.priority ?? "normal");
  const [dueTime, setDueTime] = useState(initialValues?.dueTime ?? "09:00");
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? "");
  const [isRecurring, setIsRecurring] = useState(initialValues?.isRecurring ?? true);
  const [recurringType, setRecurringType] = useState(initialValues?.recurringType ?? "daily");
  const [recurringDays, setRecurringDays] = useState<string[]>(initialValues?.recurringDays ?? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [recurringMonthDays, setRecurringMonthDays] = useState<number[]>(initialValues?.recurringMonthDays ?? [1]);
  const [biweeklyStart, setBiweeklyStart] = useState<"this" | "next">(initialValues?.biweeklyStart ?? "this");
  const [assignMode, setAssignMode] = useState<"all" | "single" | "multiple">(initialValues?.assignMode ?? "all");
  const [locationId, setLocationId] = useState(initialValues?.locationId ?? "");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(initialValues?.selectedLocationIds ?? []);
  const [points, setPoints] = useState(initialValues?.points ?? 10);
  const [allowEarlyComplete, setAllowEarlyComplete] = useState(initialValues?.allowEarlyComplete ?? false);
  const [showInToday, setShowInToday] = useState(initialValues?.showInToday ?? true);
  const [showIn7Day, setShowIn7Day] = useState(initialValues?.showIn7Day ?? true);
  const [showInCalendar, setShowInCalendar] = useState(initialValues?.showInCalendar ?? true);

  const isReminder = type === "reminder";

  const toggleDay = (day: string) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (type !== "reminder" && !dueTime) return;

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

    const locationIds: Array<string | null> =
      assignMode === "all" ? [null]
      : assignMode === "single" ? [locationId || null]
      : selectedLocationIds.length > 0 ? selectedLocationIds
      : [null];

    try {
      if (editingTask) {
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, id: editingTask.id, locationId: locationIds[0] }),
        });
        if (res.ok) { onSaved(); onClose(); }
        return;
      }
      await Promise.all(locationIds.map((lid) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, locationId: lid }),
        })
      ));
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save task error:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <motion.div
        ref={trapRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={editingTask ? "Edit task" : "Create new task"}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">
            {editingTask ? "Edit Task" : "New Task"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="rounded-xl"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description / Instructions</label>
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
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                    type === t.value
                      ? "border-[var(--hub-red)] bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40 dark:border-muted-foreground/60 dark:text-muted-foreground/80 dark:hover:border-muted-foreground/80 dark:hover:text-muted-foreground/100"
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
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Priority</label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                    priority === p.value
                      ? "border-[var(--hub-red)] bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40 dark:border-muted-foreground/60 dark:text-muted-foreground/80 dark:hover:border-muted-foreground/80 dark:hover:text-muted-foreground/100"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date + Time + Points */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!isRecurring && (
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Due Date</label>
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
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Due Time</label>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}
            <div className="w-24">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Points</label>
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
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
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
                          ? "border-[var(--hub-red)] bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      )}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>

                {/* Weekly / Biweekly: day-of-week picker */}
                {(recurringType === "weekly" || recurringType === "biweekly") && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
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
                              : "bg-muted text-muted-foreground"
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
                    <p className="mb-1.5 text-[11px] text-muted-foreground">First occurrence:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBiweeklyStart("this")}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                          biweeklyStart === "this"
                            ? "bg-[var(--hub-red)] text-white"
                            : "bg-muted text-muted-foreground"
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
                            : "bg-muted text-muted-foreground"
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
                    <p className="mb-1.5 text-[11px] text-muted-foreground">Repeats on day(s) of month:</p>
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
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recurringType === "daily" && (
                  <p className="text-[11px] text-muted-foreground">Repeats every day.</p>
                )}
              </>
            )}
          </div>

          {/* Location Assignment */}
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Assign to</label>
            <div className="flex gap-2">
              {(["all", "single", "multiple"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAssignMode(mode)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-all",
                    assignMode === mode
                      ? "border-[var(--hub-red)] bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40 dark:border-muted-foreground/60 dark:text-muted-foreground/80 dark:hover:border-muted-foreground/80 dark:hover:text-muted-foreground/100"
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
                        ? "border-[var(--hub-red)] bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    )}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}
            {assignMode === "multiple" && selectedLocationIds.length > 0 && !editingTask && (
              <p className="text-[11px] text-muted-foreground">
                Will create {selectedLocationIds.length} separate task{selectedLocationIds.length > 1 ? "s" : ""}, one per location.
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Options</p>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allowEarlyComplete}
                onChange={(e) => setAllowEarlyComplete(e.target.checked)}
                className="rounded"
              />
              <span className="font-medium">Allow early completion</span>
              <span className="text-[10px] text-muted-foreground">(can be completed before due date)</span>
            </label>

            <div>
              <p className="mb-1.5 text-[11px] text-muted-foreground">Show this task in:</p>
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
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                        : "border-border bg-card text-muted-foreground"
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
              onClick={onClose}
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
  );
}
