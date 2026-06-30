export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueTime: string;
  isAllDay?: boolean;
  isCompleted: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
}
