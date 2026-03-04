import {
  Clock,
  SprayCan,
  ClipboardList,
  Sparkles,
} from "@/lib/icons";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueTime: string;
  dueDate: string | null;
  isRecurring: boolean;
  recurringType: string | null;
  recurringDays: string | null;
  locationId: string | null;
  isHidden: boolean;
  allowEarlyComplete: boolean;
  showInToday: boolean;
  showIn7Day: boolean;
  showInCalendar: boolean;
  points: number;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  storeNumber: string;
}

export const RECURRING_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const TYPES = [
  { value: "task", label: "Task", icon: ClipboardList },
  { value: "cleaning", label: "Cleaning", icon: SprayCan },
  { value: "reminder", label: "Reminder", icon: Clock },
  { value: "training", label: "Training", icon: Sparkles },
];

export const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-muted text-muted-foreground" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
];

export interface TaskTemplate {
  label: string;
  category: string;
  fields: {
    title: string;
    description?: string;
    type: string;
    priority: string;
    dueTime: string;
    isRecurring: boolean;
    recurringType: string;
    recurringDays?: string[];
    points: number;
    allowEarlyComplete?: boolean;
  };
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  // Opening
  { label: "Opening Checklist", category: "Opening", fields: { title: "Opening Checklist", description: "Complete all opening procedures before service", type: "task", priority: "urgent", dueTime: "10:00", isRecurring: true, recurringType: "daily", points: 20, allowEarlyComplete: false } },
  { label: "Cash Drawer Setup", category: "Opening", fields: { title: "Cash Drawer Setup", description: "Count and verify cash drawer balance", type: "task", priority: "high", dueTime: "10:00", isRecurring: true, recurringType: "daily", points: 15 } },
  // Cleaning
  { label: "Morning Deep Clean", category: "Cleaning", fields: { title: "Morning Deep Clean", description: "Deep clean kitchen equipment and surfaces", type: "cleaning", priority: "high", dueTime: "08:00", isRecurring: true, recurringType: "daily", points: 25 } },
  { label: "Fryer Cleaning", category: "Cleaning", fields: { title: "Fryer Filter & Clean", description: "Filter fryer oil and clean fryer equipment", type: "cleaning", priority: "urgent", dueTime: "14:00", isRecurring: true, recurringType: "daily", points: 20 } },
  { label: "Bathroom Check", category: "Cleaning", fields: { title: "Bathroom Inspection & Clean", description: "Inspect and clean customer restrooms", type: "cleaning", priority: "normal", dueTime: "11:00", isRecurring: true, recurringType: "daily", recurringDays: ["mon","tue","wed","thu","fri","sat","sun"], points: 10 } },
  { label: "Dining Room Wipe", category: "Cleaning", fields: { title: "Dining Room Wipe Down", description: "Wipe all tables, chairs and touch surfaces", type: "cleaning", priority: "normal", dueTime: "12:00", isRecurring: true, recurringType: "daily", points: 10 } },
  { label: "Weekly Deep Clean", category: "Cleaning", fields: { title: "Weekly Deep Clean", description: "Full restaurant deep clean including walk-in cooler", type: "cleaning", priority: "high", dueTime: "09:00", isRecurring: true, recurringType: "weekly", recurringDays: ["sun"], points: 50 } },
  // Prep
  { label: "Food Temp Check", category: "Prep", fields: { title: "Food Temperature Check", description: "Log temperatures for all hot/cold holding equipment", type: "task", priority: "urgent", dueTime: "10:00", isRecurring: true, recurringType: "daily", points: 15, allowEarlyComplete: true } },
  { label: "Chicken Thaw", category: "Prep", fields: { title: "Chicken Thaw & Prep", description: "Move chicken from freezer, begin marination", type: "task", priority: "high", dueTime: "08:00", isRecurring: true, recurringType: "daily", points: 15 } },
  { label: "Waste Log", category: "Prep", fields: { title: "Waste Log Completion", description: "Record all food waste for the day", type: "task", priority: "normal", dueTime: "22:00", isRecurring: true, recurringType: "daily", points: 10 } },
  // Closing
  { label: "Closing Checklist", category: "Closing", fields: { title: "Closing Checklist", description: "Complete all closing procedures", type: "task", priority: "urgent", dueTime: "22:30", isRecurring: true, recurringType: "daily", points: 20 } },
  { label: "Safe Count", category: "Closing", fields: { title: "End of Day Safe Count", description: "Count and secure all cash in safe", type: "task", priority: "high", dueTime: "23:00", isRecurring: true, recurringType: "daily", points: 20 } },
  // Compliance
  { label: "Health Inspection Prep", category: "Compliance", fields: { title: "Health Inspection Prep", description: "Review food safety logs and ensure compliance", type: "task", priority: "urgent", dueTime: "09:00", isRecurring: false, recurringType: "daily", points: 30 } },
  { label: "Monthly Safety Review", category: "Compliance", fields: { title: "Monthly Safety Review", description: "Review safety procedures and log completion", type: "reminder", priority: "high", dueTime: "10:00", isRecurring: true, recurringType: "monthly", points: 20 } },
];

export const TEMPLATE_CATEGORIES = [...new Set(TASK_TEMPLATES.map((t) => t.category))];

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}
