"use client";

import { TaskManager } from "@/components/arl/task-manager";

export default function TasksPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overscroll-contain p-4">
      <TaskManager />
    </div>
  );
}
