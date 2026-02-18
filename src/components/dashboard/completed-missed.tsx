"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type TaskItem } from "./timeline";

interface CompletedMissedProps {
  completedToday: TaskItem[];
  missedYesterday: TaskItem[];
  pointsToday: number;
  totalToday: number;
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
  pointsToday,
  totalToday,
}: CompletedMissedProps) {
  const completionRate = totalToday > 0
    ? Math.round((completedToday.length / totalToday) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Points & Progress Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--hub-red)] to-[#c4001f] p-4 text-white shadow-lg shadow-red-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/70">Today&apos;s Points</p>
            <div className="flex items-baseline gap-1">
              <motion.span
                key={pointsToday}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-black"
              >
                {pointsToday}
              </motion.span>
              <Sparkles className="h-4 w-4 text-yellow-300" />
            </div>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Trophy className="h-7 w-7 text-yellow-300" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/70">Progress</span>
            <span className="font-bold">
              {completedToday.length}/{totalToday} tasks
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/20">
            <motion.div
              className="h-2 rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {completionRate === 100 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-yellow-300"
          >
            <Flame className="h-3.5 w-3.5" />
            All tasks completed! Amazing work!
          </motion.div>
        )}
      </div>

      {/* Completed Today */}
      <div className="flex flex-[3] flex-col overflow-hidden">
        <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
          <CheckCircle2 className="h-4 w-4 text-[var(--hub-green)]" />
          <h3 className="text-sm font-bold text-slate-800">
            Completed Today
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              ({completedToday.length})
            </span>
          </h3>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {completedToday.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">
              No tasks completed yet
            </p>
          ) : (
            completedToday.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-xl bg-emerald-50/50 px-3 py-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="flex-1 truncate text-xs font-medium text-slate-600 line-through">
                  {task.title}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {formatTime12(task.dueTime)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Missed Yesterday */}
      <div className="flex flex-[2] flex-col overflow-hidden">
        <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
          <XCircle className="h-4 w-4 text-[var(--hub-red)]" />
          <h3 className="text-sm font-bold text-slate-800">
            Missed Yesterday
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              ({missedYesterday.length})
            </span>
          </h3>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {missedYesterday.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">
              No missed tasks - great job!
            </p>
          ) : (
            missedYesterday.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 rounded-xl bg-red-50/50 px-3 py-2"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="flex-1 truncate text-xs font-medium text-slate-600">
                  {task.title}
                </span>
                <span className="shrink-0 text-[10px] text-red-400">
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
