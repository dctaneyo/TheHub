import { type TaskItem } from "@/components/dashboard/timeline";

export interface DashboardLayoutProps {
  // Data
  allTasks: TaskItem[];
  completedTasks: TaskItem[];
  missedYesterday: TaskItem[];
  pointsToday: number;
  totalToday: number;
  currentTime: string;
  upcomingTasks: Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string; allowEarlyComplete?: boolean; isCompleted?: boolean }>>;
  currentLocationId?: string;

  // Handlers
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onEarlyComplete: (taskId: string, dateStr: string) => void;
}
