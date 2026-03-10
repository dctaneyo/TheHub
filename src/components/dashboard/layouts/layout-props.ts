import { type TaskItem } from "@/components/dashboard/timeline";

export interface DashboardLayoutProps {
  // Data
  allTasks: TaskItem[];
  completedTasks: TaskItem[];
  missedYesterday: TaskItem[];
  pointsToday: number;
  totalToday: number;
  currentTime: string;
  displayTime?: string;
  upcomingTasks: Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string; allowEarlyComplete?: boolean; isCompleted?: boolean }>>;
  currentLocationId?: string;

  // Layout state
  targetIsMobile?: boolean;

  // Handlers
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onEarlyComplete: (taskId: string, dateStr: string) => void;
}
