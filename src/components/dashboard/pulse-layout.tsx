"use client";

import { useMemo } from "react";
import { DayPhaseBackground } from "@/components/dashboard/day-phase-background";
import { Heartbeat } from "@/components/dashboard/heartbeat";
import { TaskOrbs } from "@/components/dashboard/task-orbs";
import { useDayPhase } from "@/lib/day-phase-context";
import type { TaskItem } from "@/components/dashboard/timeline";

interface PulseLayoutProps {
  tasks: TaskItem[];
  currentTime: string;
  pointsToday: number;
  streak: number;
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
}

export function PulseLayout({
  tasks,
  currentTime,
  pointsToday,
  streak,
  onComplete,
  onUncomplete,
}: PulseLayoutProps) {
  const overdueCount = useMemo(
    () => tasks.filter((t) => t.isOverdue && !t.isCompleted).length,
    [tasks]
  );

  const dueSoonCount = useMemo(
    () => tasks.filter((t) => t.isDueSoon && !t.isCompleted).length,
    [tasks]
  );

  const healthScore = useMemo(
    () => Math.max(0, Math.min(100, 100 - overdueCount * 15 - dueSoonCount * 5)),
    [overdueCount, dueSoonCount]
  );

  const { phase: dayPhase } = useDayPhase();

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* Day-phase ambient background */}
      <DayPhaseBackground />

      {/* Heartbeat at center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <Heartbeat
          health={healthScore}
          overdueCount={overdueCount}
          dueSoonCount={dueSoonCount}
          pointsToday={pointsToday}
          streak={streak}
          dayPhase={dayPhase}
          large
        />
      </div>

      {/* Task orbs layer */}
      <div className="absolute inset-0 z-20">
        <TaskOrbs
          tasks={tasks}
          currentTime={currentTime}
          onComplete={onComplete}
          onUncomplete={onUncomplete}
          dayPhase={dayPhase}
        />
      </div>
    </div>
  );
}
