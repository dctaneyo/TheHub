import { z } from "zod";

// ── Task schemas ──

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(2000).nullable().optional(),
  type: z.enum(["task", "reminder", "cleaning"]).default("task"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, "Due time must be HH:mm format"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD").nullable().optional(),
  isRecurring: z.boolean().default(false),
  recurringType: z.enum(["daily", "weekly", "biweekly", "monthly"]).nullable().optional(),
  recurringDays: z.union([z.string(), z.array(z.string()), z.array(z.number())]).nullable().optional(),
  biweeklyStart: z.enum(["this", "next"]).nullable().optional(),
  locationId: z.string().nullable().optional(),
  points: z.number().int().min(0).max(10000).default(10),
  allowEarlyComplete: z.boolean().default(false),
  showInToday: z.boolean().default(true),
  showIn7Day: z.boolean().default(true),
  showInCalendar: z.boolean().default(true),
});

export const updateTaskSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  type: z.enum(["task", "reminder", "cleaning"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurringType: z.enum(["daily", "weekly", "biweekly", "monthly"]).nullable().optional(),
  recurringDays: z.union([z.string(), z.array(z.string()), z.array(z.number())]).nullable().optional(),
  biweeklyStart: z.enum(["this", "next"]).nullable().optional(),
  locationId: z.string().nullable().optional(),
  isHidden: z.boolean().optional(),
  allowEarlyComplete: z.boolean().optional(),
  showInToday: z.boolean().optional(),
  showIn7Day: z.boolean().optional(),
  showInCalendar: z.boolean().optional(),
  points: z.number().int().min(0).max(10000).optional(),
});

// ── Auth schemas ──

export const loginSchema = z.object({
  userId: z.string().length(4, "User ID must be 4 digits").regex(/^\d{4}$/, "User ID must be numeric"),
  pin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be numeric"),
});

// ── Message schemas ──

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  content: z.string().min(1, "Message content is required").max(10000),
  type: z.enum(["text", "image", "file"]).default("text"),
});

// ── Notification schemas ──

export const createNotificationSchema = z.object({
  userId: z.string().min(1),
  userType: z.enum(["location", "arl", "admin"]),
  type: z.string().min(1),
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  metadata: z.record(z.string(), z.any()).optional(),
});

// ── Emergency schemas ──

export const emergencyBroadcastSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  targetLocationIds: z.array(z.string()).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

// ── Helper: validate and return parsed data or error response ──

export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ");
  return { success: false, error: messages };
}
