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

// ── ARL schemas ──

export const createArlSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").nullable().optional(),
  userId: z.string().length(4, "User ID must be 4 digits").regex(/^\d{4}$/, "User ID must be numeric"),
  pin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be numeric"),
  role: z.enum(["arl", "admin"]).default("arl"),
});

export const updateArlSchema = z.object({
  id: z.string().min(1, "ARL ID is required"),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  pin: z.string().length(4).regex(/^\d{4}$/).optional(),
  role: z.enum(["arl", "admin"]).optional(),
  roleId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  permissions: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  assignedLocationIds: z.array(z.string()).nullable().optional(),
});

// ── Broadcast schemas ──

export const createBroadcastSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(2000).nullable().optional(),
  streamMode: z.string().optional(),
  targetAudience: z.string().optional(),
  targetLocationIds: z.array(z.string()).nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
});

// ── Location schemas ──

export const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  storeNumber: z.string().min(1, "Store number is required").max(50),
  userId: z.string().length(4, "User ID must be 4 digits").regex(/^\d{4}$/, "User ID must be numeric"),
  pin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be numeric"),
  email: z.string().email("Invalid email").nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});

export const updateLocationSchema = z.object({
  id: z.string().min(1, "Location ID is required"),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  storeNumber: z.string().min(1).max(50).optional(),
  pin: z.string().length(4).regex(/^\d{4}$/).optional(),
  address: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Conversation schemas ──

export const createConversationSchema = z.object({
  type: z.enum(["direct", "group"]),
  name: z.string().max(200).nullable().optional(),
  memberIds: z.array(z.object({
    memberId: z.string().min(1),
    memberType: z.enum(["location", "arl"]),
  })).min(1, "At least one member required"),
});

// ── Location Group schemas ──

export const createLocationGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  parentId: z.string().nullable().optional(),
  locationIds: z.array(z.string()).optional(),
});

export const updateLocationGroupSchema = z.object({
  id: z.string().min(1, "Group ID is required"),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  parentId: z.string().nullable().optional(),
  locationIds: z.array(z.string()).optional(),
});

// ── Scheduled Report schemas ──

export const createScheduledReportSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["task_completion", "leaderboard", "attendance", "messaging"]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipients: z.array(z.string().email()).min(1, "At least one recipient required"),
  filters: z.object({
    locationIds: z.array(z.string()).optional(),
    groupIds: z.array(z.string()).optional(),
  }).nullable().optional(),
});

export const updateScheduledReportSchema = z.object({
  id: z.string().min(1, "Report ID is required"),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["task_completion", "leaderboard", "attendance", "messaging"]).optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  recipients: z.array(z.string().email()).optional(),
  filters: z.object({
    locationIds: z.array(z.string()).optional(),
    groupIds: z.array(z.string()).optional(),
  }).nullable().optional(),
  isActive: z.boolean().optional(),
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
