"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar } from "@/lib/icons";
import { SubPageHeader } from "@/components/sub-page-header";
import { CalendarModal } from "@/components/dashboard/grid/grid-calendar";
import { taskApplies, type CalTask } from "@/lib/task-calendar";

/**
 * Full calendar — reuses the exact same month-grid + selected-day-list
 * component the dashboard's Calendar widget opens in a floating modal
 * (CalendarModal), and the same taskApplies() rules used everywhere else a
 * task's recurrence is evaluated. The previous version of this page had its
 * own separate, never-reconciled copy of both, which is why it used to show
 * different tasks than the widget for the same day.
 */
export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date");
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    initialDate ? new Date(`${initialDate}T12:00:00`) : new Date()
  );

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tasks) setTasks(d.tasks); })
      .catch(() => { /* keep last-known list */ });
  }, []);

  const getTasksForDate = (date: Date) =>
    tasks
      .filter((t) => t.showInCalendar !== false && taskApplies(t, date))
      .sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  return (
    <div className="flex h-screen flex-col bg-background">
      <SubPageHeader title="Calendar" icon={Calendar} currentPath="/calendar" />
      <div className="min-h-0 flex-1">
        <CalendarModal
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          getTasksForDate={getTasksForDate}
        />
      </div>
    </div>
  );
}
