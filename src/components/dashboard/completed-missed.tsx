"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "@/lib/icons";
import { type TaskItem } from "./timeline";

interface CompletedMissedProps {
  completedToday: TaskItem[];
  missedYesterday: TaskItem[];
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function CompletedMissed({
  completedToday,
  missedYesterday,
}: CompletedMissedProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Completed Today */}
      <div>
        <div className="mb-2 flex items-center gap-2 px-1">
          <CheckCircle2 className="h-4 w-4 text-[var(--hub-green)]" />
          <h3 className="text-base font-bold text-foreground">
            Completed Today
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({completedToday.length})
            </span>
          </h3>
        </div>
        <div className="space-y-1">
          {completedToday.length === 0 ? (
            <p className="rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">
              No tasks completed yet
            </p>
          ) : (
            completedToday.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2.5"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="flex-1 truncate text-sm font-medium text-muted-foreground line-through">
                  {task.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTime12(task.dueTime)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Missed Yesterday */}
      <div>
        <div className="mb-2 flex items-center gap-2 px-1">
          <XCircle className="h-4 w-4 text-[var(--hub-red)]" />
          <h3 className="text-base font-bold text-foreground">
            Missed Yesterday
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({missedYesterday.length})
            </span>
          </h3>
        </div>
        <div className="space-y-1">
          {missedYesterday.length === 0 ? (
            <p className="rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">
              No missed tasks - great job!
            </p>
          ) : (
            missedYesterday.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 rounded-xl bg-red-50/50 dark:bg-red-950/30 px-3 py-2.5"
              >
                <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="flex-1 truncate text-sm font-medium text-muted-foreground">
                  {task.title}
                </span>
                <span className="shrink-0 text-xs text-red-400">
                  {formatTime12(task.dueTime)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
