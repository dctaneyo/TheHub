import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Locations (restaurants)
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  storeNumber: text("store_number").notNull().unique(),
  address: text("address"),
  email: text("email"), // for sending forms
  userId: text("user_id").notNull().unique(), // 6-digit login ID
  pinHash: text("pin_hash").notNull(), // hashed 6-digit PIN
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ARLs (Above Restaurant Leaders)
export const arls = sqliteTable("arls", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  email: text("email"),
  userId: text("user_id").notNull().unique(), // 6-digit login ID
  pinHash: text("pin_hash").notNull(), // hashed 6-digit PIN
  role: text("role").notNull().default("arl"), // 'arl' | 'admin'
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Sessions - track which locations are connected
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // UUID
  sessionCode: text("session_code"), // 6-digit human-readable session ID
  userType: text("user_type").notNull(), // 'location' | 'arl'
  userId: text("user_id").notNull(), // references locations.id or arls.id
  token: text("token").notNull(),
  socketId: text("socket_id"), // current socket.io connection ID
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  lastSeen: text("last_seen").notNull().$defaultFn(() => new Date().toISOString()),
  deviceType: text("device_type"), // 'kiosk' | 'desktop' | 'tablet' | 'mobile'
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
});

// Tasks & Reminders
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(), // UUID
  title: text("title").notNull(),
  description: text("description"), // details/notes/instructions
  type: text("type").notNull().default("task"), // 'task' | 'reminder' | 'cleaning'
  priority: text("priority").notNull().default("normal"), // 'low' | 'normal' | 'high' | 'urgent'
  dueTime: text("due_time").notNull(), // ISO time string (HH:mm) for daily scheduling
  dueDate: text("due_date"), // ISO date string - null means recurring daily
  isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
  recurringType: text("recurring_type"), // 'daily' | 'weekly' | 'biweekly' | 'monthly'
  recurringDays: text("recurring_days"), // JSON array of days for weekly: ["mon","tue",...] or day-of-month for monthly
  biweeklyStart: text("biweekly_start"), // 'this' | 'next' for biweekly tasks
  locationId: text("location_id"), // null = all locations
  createdBy: text("created_by").notNull(), // ARL id or location id who created it
  createdByType: text("created_by_type").notNull().default("arl"), // 'arl' | 'location'
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false), // hide from dashboard/calendar
  points: integer("points").notNull().default(10), // gamification points
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Task completions - tracks when a location completes a task
export const taskCompletions = sqliteTable("task_completions", {
  id: text("id").primaryKey(), // UUID
  taskId: text("task_id").notNull(),
  locationId: text("location_id").notNull(),
  completedAt: text("completed_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedDate: text("completed_date").notNull(), // YYYY-MM-DD for easy querying
  notes: text("notes"),
  pointsEarned: integer("points_earned").notNull().default(0),
});

// Messages - instant messaging
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  senderType: text("sender_type").notNull(), // 'location' | 'arl'
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull().default(""),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // 'text' | 'image' | 'file'
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Conversations - supports direct, global, and group chats
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("direct"), // 'direct' | 'global' | 'group'
  name: text("name"), // for group chats; null for direct
  // For direct chats: participantAId + participantBId identify the pair
  participantAId: text("participant_a_id"), // location.id or arl.id
  participantAType: text("participant_a_type"), // 'location' | 'arl'
  participantBId: text("participant_b_id"),
  participantBType: text("participant_b_type"),
  lastMessageAt: text("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  createdBy: text("created_by"), // arl.id who created group/global
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Conversation members - for group chats
export const conversationMembers = sqliteTable("conversation_members", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  memberId: text("member_id").notNull(), // location.id or arl.id
  memberType: text("member_type").notNull(), // 'location' | 'arl'
  joinedAt: text("joined_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Message read receipts
export const messageReads = sqliteTable("message_reads", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  readerType: text("reader_type").notNull(), // 'location' | 'arl'
  readerId: text("reader_id").notNull(),
  readAt: text("read_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Forms repository
export const forms = sqliteTable("forms", {
  id: text("id").primaryKey(), // UUID
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // path to stored PDF
  fileSize: integer("file_size").notNull(),
  uploadedBy: text("uploaded_by").notNull(), // ARL id
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Gamification - location scores
export const locationScores = sqliteTable("location_scores", {
  id: text("id").primaryKey(), // UUID
  locationId: text("location_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  pointsEarned: integer("points_earned").notNull().default(0),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  tasksMissed: integer("tasks_missed").notNull().default(0),
  streak: integer("streak").notNull().default(0), // consecutive days with all tasks done
});

// Emergency broadcasts
export const emergencyMessages = sqliteTable("emergency_messages", {
  id: text("id").primaryKey(),
  message: text("message").notNull(),
  sentBy: text("sent_by").notNull(), // ARL id
  sentByName: text("sent_by_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  targetLocationIds: text("target_location_ids"), // JSON array of location IDs, null = all
  viewedBy: text("viewed_by").notNull().default("[]"), // JSON array of location IDs that have viewed
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"), // optional expiry
});

// Notifications
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), // UUID
  locationId: text("location_id").notNull(),
  type: text("type").notNull(), // 'task_due_soon' | 'task_overdue' | 'message' | 'system'
  title: text("title").notNull(),
  body: text("body"),
  referenceId: text("reference_id"), // task_id or message_id
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  isDismissed: integer("is_dismissed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Push notification subscriptions
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull(), // ARL user ID
  endpoint: text("endpoint").notNull(), // Push endpoint URL
  p256dh: text("p256dh").notNull(), // Public key
  auth: text("auth").notNull(), // Auth secret
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});
