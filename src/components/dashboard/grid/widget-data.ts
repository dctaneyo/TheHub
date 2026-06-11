import type { TaskItem } from "@/components/dashboard/timeline";

// Mirror of mini-calendar's internal UpcomingTask shape. Defined locally so we
// don't have to modify the shared (production) mini-calendar component.
export interface UpcomingTask {
  id: string;
  title: string;
  dueTime: string;
  type: string;
  priority: string;
  allowEarlyComplete?: boolean;
  isCompleted?: boolean;
}

/** Live app data + handlers shared with every widget. Layout state is kept
 *  entirely separate (in the grid engine) from this app data. */
export interface WidgetData {
  // tasks / timeline
  tasks: TaskItem[];
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;

  // calendar
  upcomingTasks: Record<string, UpcomingTask[]>;
  onEarlyComplete: (taskId: string, dateStr: string) => void;

  // completed / missed / stats
  completedToday: TaskItem[];
  missedYesterday: TaskItem[];
  pointsToday: number;
  totalToday: number;

  // leaderboard
  currentLocationId?: string;

  // launchers (open the existing overlay components unchanged)
  chatUnread: number;
  onOpenChat: () => void;
  onOpenForms: () => void;
}
