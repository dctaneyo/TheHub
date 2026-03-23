import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";

// Tenants (franchise brands)
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(), // UUID
  slug: text("slug").notNull().unique(), // subdomain: "kazi", "mcdo", etc.
  name: text("name").notNull(), // display name
  logoUrl: text("logo_url"), // branding
  primaryColor: text("primary_color").notNull().default("#dc2626"), // CSS var(--hub-red)
  accentColor: text("accent_color"),
  faviconUrl: text("favicon_url"),
  appTitle: text("app_title"), // e.g. "KFC Team Hub"
  plan: text("plan").notNull().default("starter"), // 'starter' | 'pro' | 'enterprise'
  features: text("features").notNull().default('["messaging","tasks","forms","gamification","meetings","analytics","broadcasts"]'), // JSON array
  maxLocations: integer("max_locations").notNull().default(50),
  maxUsers: integer("max_users").notNull().default(20),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  customDomain: text("custom_domain"), // e.g. "hub.kfc.com"
  timezone: text("timezone").notNull().default("Pacific/Honolulu"), // IANA timezone for task scheduling
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Locations (restaurants)
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  name: text("name").notNull(),
  storeNumber: text("store_number").notNull(),
  address: text("address"),
  email: text("email"), // for sending forms
  userId: text("user_id").notNull().unique(), // 4-digit login ID
  pinHash: text("pin_hash").notNull(), // hashed 4-digit PIN
  timezone: text("timezone"), // IANA timezone override — null = use tenant default
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  soundMuted: integer("sound_muted", { mode: "boolean" }).notNull().default(false),
  dashboardLayout: text("dashboard_layout").notNull().default("classic"),
  patternHash: text("pattern_hash"), // bcrypt hash of constellation pattern
  latitude: real("latitude"), // War Room map positioning
  longitude: real("longitude"), // War Room map positioning
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ARLs (Above Restaurant Leaders)
export const arls = sqliteTable("arls", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  name: text("name").notNull(),
  email: text("email"),
  userId: text("user_id").notNull().unique(), // 4-digit login ID
  pinHash: text("pin_hash").notNull(), // hashed 4-digit PIN
  role: text("role").notNull().default("arl"), // 'arl' | 'admin'
  roleId: text("role_id"), // references roles.id — null = custom/manual permissions
  permissions: text("permissions"), // JSON array of enabled permission keys — null = all (default)
  assignedLocationIds: text("assigned_location_ids"), // JSON array of location IDs — null = all locations
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  dashboardLayout: text("dashboard_layout").notNull().default("classic"),
  patternHash: text("pattern_hash"), // bcrypt hash of constellation pattern
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Sessions - track which locations are connected
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // UUID
  sessionCode: text("session_code"), // 4-digit human-readable session ID
  userType: text("user_type").notNull(), // 'location' | 'arl'
  userId: text("user_id").notNull(), // references locations.id or arls.id
  token: text("token").notNull(),
  socketId: text("socket_id"), // current socket.io connection ID
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  lastSeen: text("last_seen").notNull().$defaultFn(() => new Date().toISOString()),
  deviceType: text("device_type"), // 'kiosk' | 'desktop' | 'tablet' | 'mobile'
  currentPage: text("current_page"), // current page/section user is viewing
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
});

// Tasks & Reminders
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
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
  allowEarlyComplete: integer("allow_early_complete", { mode: "boolean" }).notNull().default(false), // can be completed before due date
  showInToday: integer("show_in_today", { mode: "boolean" }).notNull().default(true), // show in Today's Tasks timeline
  showIn7Day: integer("show_in_7day", { mode: "boolean" }).notNull().default(true), // show in 7-day upcoming view
  showInCalendar: integer("show_in_calendar", { mode: "boolean" }).notNull().default(true), // show in full calendar
  points: integer("points").notNull().default(10), // gamification points
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Task completions - tracks when a location completes a task
export const taskCompletions = sqliteTable("task_completions", {
  id: text("id").primaryKey(), // UUID
  taskId: text("task_id").notNull().references(() => tasks.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  completedAt: text("completed_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedDate: text("completed_date").notNull(), // YYYY-MM-DD for easy querying
  notes: text("notes"),
  pointsEarned: integer("points_earned").notNull().default(0),
  bonusPoints: integer("bonus_points").notNull().default(0), // early bird bonus
});

// Messages - instant messaging
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  senderType: text("sender_type").notNull(), // 'location' | 'arl'
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull().default(""),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // 'text' | 'image' | 'file' | 'voice'
  metadata: text("metadata"), // JSON string for voice messages etc.
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Conversations - supports direct, global, and group chats
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  type: text("type").notNull().default("direct"), // 'direct' | 'global' | 'group'
  name: text("name"), // for group chats; null for direct
  description: text("description"), // group purpose/description
  avatarColor: text("avatar_color"), // hex color for group icon
  // For direct chats: participantAId + participantBId identify the pair
  participantAId: text("participant_a_id"), // location.id or arl.id
  participantAType: text("participant_a_type"), // 'location' | 'arl'
  participantBId: text("participant_b_id"),
  participantBType: text("participant_b_type"),
  lastMessageAt: text("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  createdBy: text("created_by"), // location.id or arl.id who created group/global
  createdByType: text("created_by_type"), // 'location' | 'arl'
  deletedBy: text("deleted_by").notNull().default("[]"), // JSON array of user IDs who hid this thread
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Conversation members - for group chats
export const conversationMembers = sqliteTable("conversation_members", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  memberId: text("member_id").notNull(), // location.id or arl.id
  memberType: text("member_type").notNull(), // 'location' | 'arl'
  role: text("role").notNull().default("member"), // 'admin' | 'member'
  joinedAt: text("joined_at").notNull().$defaultFn(() => new Date().toISOString()),
  leftAt: text("left_at"), // null = active member
});

// Message read receipts
export const messageReads = sqliteTable("message_reads", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id),
  readerType: text("reader_type").notNull(), // 'location' | 'arl'
  readerId: text("reader_id").notNull(),
  readAt: text("read_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Message reactions
export const messageReactions = sqliteTable("message_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id),
  userId: text("user_id").notNull(),
  userType: text("user_type").notNull(), // 'location' | 'arl'
  userName: text("user_name").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Conversation settings - per-user notification preferences
export const conversationSettings = sqliteTable("conversation_settings", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  userId: text("user_id").notNull(),
  userType: text("user_type").notNull(), // 'location' | 'arl'
  isMuted: integer("is_muted", { mode: "boolean" }).notNull().default(false),
  mutedUntil: text("muted_until"), // null = muted forever
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Forms repository
export const forms = sqliteTable("forms", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // kept for backwards compat
  fileContent: blob("file_content"), // PDF bytes stored in DB (survives redeployments)
  fileSize: integer("file_size").notNull(),
  uploadedBy: text("uploaded_by").notNull(), // ARL id
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Daily leaderboard (points, streaks, etc.)
export const dailyLeaderboard = sqliteTable("daily_leaderboard", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
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
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  message: text("message").notNull(),
  sentBy: text("sent_by").notNull(), // ARL id
  sentByName: text("sent_by_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  targetLocationIds: text("target_location_ids"), // JSON array of location IDs, null = all
  viewedBy: text("viewed_by").notNull().default("[]"), // JSON array of location IDs that have viewed
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"), // optional expiry
});

// Notifications - unified notification center
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  userId: text("user_id").notNull(), // references locations.id or arls.id
  userType: text("user_type").notNull(), // 'location' | 'arl' | 'admin'
  type: text("type").notNull(), // notification category (task_due_soon, new_message, etc.)
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"), // optional link to relevant page
  actionLabel: text("action_label"), // optional CTA text
  priority: text("priority").notNull().default("normal"), // 'low' | 'normal' | 'high' | 'urgent'
  metadata: text("metadata"), // JSON string for additional data
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  readAt: text("read_at"), // when marked as read
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Pending sessions - pre-login session IDs shown on login screen
export const pendingSessions = sqliteTable("pending_sessions", {
  id: text("id").primaryKey(), // UUID
  code: text("code").notNull().unique(), // 4-digit code shown on login screen
  status: text("status").notNull().default("pending"), // 'pending' | 'activated'
  // Filled in by ARL when activating:
  assignedUserType: text("assigned_user_type"), // 'location' | 'arl'
  assignedUserId: text("assigned_user_id"), // references locations.id or arls.id
  activatedBy: text("activated_by"), // ARL id who activated
  token: text("token"), // JWT token set when activated
  redirectTo: text("redirect_to"), // '/dashboard' | '/arl'
  userAgent: text("user_agent"), // from the login page request
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  activatedAt: text("activated_at"),
  expiresAt: text("expires_at").notNull(), // pending sessions expire after 15 min
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

// Notification preferences - per-user notification type settings
export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull(), // references arls.id or locations.id
  userType: text("user_type").notNull(), // 'arl' | 'admin' | 'location'
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  
  // Task notifications
  taskDueSoon: integer("task_due_soon", { mode: "boolean" }).notNull().default(true), // tasks due in 30 min
  taskOverdue: integer("task_overdue", { mode: "boolean" }).notNull().default(true), // overdue tasks
  taskCompleted: integer("task_completed", { mode: "boolean" }).notNull().default(false), // task completion updates
  
  // Message notifications
  newMessage: integer("new_message", { mode: "boolean" }).notNull().default(true), // new messages in conversations
  messageReply: integer("message_reply", { mode: "boolean" }).notNull().default(true), // replies to user's messages
  
  // Location status notifications
  locationOnline: integer("location_online", { mode: "boolean" }).notNull().default(true), // location comes online
  locationOffline: integer("location_offline", { mode: "boolean" }).notNull().default(false), // location goes offline
  locationStatusChange: integer("location_status_change", { mode: "boolean" }).notNull().default(false), // status changes
  
  // Broadcast notifications
  emergencyBroadcast: integer("emergency_broadcast", { mode: "boolean" }).notNull().default(true), // emergency broadcasts
  regularBroadcast: integer("regular_broadcast", { mode: "boolean" }).notNull().default(true), // regular broadcasts
  
  // Meeting notifications
  meetingStarted: integer("meeting_started", { mode: "boolean" }).notNull().default(true), // meeting started
  meetingEnded: integer("meeting_ended", { mode: "boolean" }).notNull().default(false), // meeting ended
  meetingReminder: integer("meeting_reminder", { mode: "boolean" }).notNull().default(true), // 15 min before meeting
  
  // Gamification notifications
  newShoutout: integer("new_shoutout", { mode: "boolean" }).notNull().default(true), // received shoutout
  leaderboardUpdate: integer("leaderboard_update", { mode: "boolean" }).notNull().default(false), // weekly leaderboard
  
  // System notifications
  systemAlert: integer("system_alert", { mode: "boolean" }).notNull().default(true), // critical system alerts
  weeklyReport: integer("weekly_report", { mode: "boolean" }).notNull().default(false), // weekly summary report
  
  // Priority overrides - always send regardless of above settings
  priorityTypes: text("priority_types"), // JSON array: ["urgent"] - urgent notifications always sent
  
  // Delivery preferences
  emailNotifications: integer("email_notifications", { mode: "boolean" }).notNull().default(false), // send to email
  pushNotifications: integer("push_notifications", { mode: "boolean" }).notNull().default(true), // browser push
  inAppNotifications: integer("in_app_notifications", { mode: "boolean" }).notNull().default(true), // in-app bell
  
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Live broadcasts - ARL streaming to locations
export const broadcasts = sqliteTable("broadcasts", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  arlId: text("arl_id").notNull(), // ARL who is broadcasting
  arlName: text("arl_name").notNull(),
  title: text("title").notNull(), // Broadcast title/subject
  description: text("description"), // Optional description
  status: text("status").notNull().default("live"), // 'scheduled' | 'live' | 'ended'
  streamMode: text("stream_mode").notNull().default("video"), // 'video' | 'audio' | 'text'
  targetAudience: text("target_audience").notNull().default("all"), // 'all' | 'specific'
  targetLocationIds: text("target_location_ids"), // JSON array of location IDs if specific
  recordingUrl: text("recording_url"), // URL to recorded stream (if saved)
  thumbnailUrl: text("thumbnail_url"), // Thumbnail for replay
  viewerCount: integer("viewer_count").notNull().default(0), // Current live viewers
  totalViews: integer("total_views").notNull().default(0), // Total unique viewers
  reactionCount: integer("reaction_count").notNull().default(0), // Total reactions received
  scheduledFor: text("scheduled_for"), // ISO timestamp for scheduled broadcasts
  startedAt: text("started_at"), // When stream actually started
  endedAt: text("ended_at"), // When stream ended
  duration: integer("duration"), // Duration in seconds
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Broadcast viewers - track who watched what
export const broadcastViewers = sqliteTable("broadcast_viewers", {
  id: text("id").primaryKey(), // UUID
  broadcastId: text("broadcast_id").notNull(),
  viewerType: text("viewer_type").notNull(), // 'location' | 'arl'
  viewerId: text("viewer_id").notNull(),
  viewerName: text("viewer_name").notNull(),
  joinedAt: text("joined_at").notNull().$defaultFn(() => new Date().toISOString()),
  leftAt: text("left_at"), // null if still watching
  watchDuration: integer("watch_duration"), // seconds watched
  isMinimized: integer("is_minimized", { mode: "boolean" }).notNull().default(false),
  isDismissed: integer("is_dismissed", { mode: "boolean" }).notNull().default(false),
  completionRate: real("completion_rate"), // percentage of stream watched (0-100)
});

// Broadcast reactions - live emoji reactions during stream
export const broadcastReactions = sqliteTable("broadcast_reactions", {
  id: text("id").primaryKey(), // UUID
  broadcastId: text("broadcast_id").notNull(),
  viewerType: text("viewer_type").notNull(), // 'location' | 'arl'
  viewerId: text("viewer_id").notNull(),
  viewerName: text("viewer_name").notNull(),
  emoji: text("emoji").notNull(),
  timestamp: integer("timestamp").notNull(), // seconds into the stream
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Broadcast chat messages - text chat during live stream
export const broadcastMessages = sqliteTable("broadcast_messages", {
  id: text("id").primaryKey(), // UUID
  broadcastId: text("broadcast_id").notNull(),
  senderType: text("sender_type").notNull(), // 'location' | 'arl'
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  timestamp: integer("timestamp").notNull(), // seconds into the stream
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Broadcast questions - Q&A feature during streams
export const broadcastQuestions = sqliteTable("broadcast_questions", {
  id: text("id").primaryKey(), // UUID
  broadcastId: text("broadcast_id").notNull(),
  askerType: text("asker_type").notNull(), // 'location' | 'arl'
  askerId: text("asker_id").notNull(),
  askerName: text("asker_name").notNull(),
  question: text("question").notNull(),
  answer: text("answer"), // ARL's answer
  answeredAt: text("answered_at"), // When answered
  isAnswered: integer("is_answered", { mode: "boolean" }).notNull().default(false),
  upvotes: integer("upvotes").notNull().default(0), // Other viewers can upvote questions
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Meeting analytics - track LiveKit meeting sessions
export const meetingAnalytics = sqliteTable("meeting_analytics", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  meetingId: text("meeting_id").notNull(), // LiveKit room name
  title: text("title").notNull(),
  hostId: text("host_id").notNull(), // ARL who created the meeting
  hostName: text("host_name").notNull(),
  startedAt: text("started_at").notNull().$defaultFn(() => new Date().toISOString()),
  endedAt: text("ended_at"), // null if still ongoing
  duration: integer("duration"), // Duration in seconds
  totalParticipants: integer("total_participants").notNull().default(0),
  totalLocations: integer("total_locations").notNull().default(0), // Restaurants
  totalArls: integer("total_arls").notNull().default(0),
  totalGuests: integer("total_guests").notNull().default(0),
  peakParticipants: integer("peak_participants").notNull().default(0), // Max concurrent
  totalMessages: integer("total_messages").notNull().default(0), // Chat messages
  totalQuestions: integer("total_questions").notNull().default(0), // Q&A questions
  totalReactions: integer("total_reactions").notNull().default(0), // Emoji reactions
  totalHandRaises: integer("total_hand_raises").notNull().default(0),
  screenShareDuration: integer("screen_share_duration").notNull().default(0), // seconds
  recordingUrl: text("recording_url"), // If recorded
});

// ARL-pushed ticker messages shown on location dashboards
export const tickerMessages = sqliteTable("ticker_messages", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  content: text("content").notNull(),
  icon: text("icon").notNull().default("📢"),
  arlId: text("arl_id").notNull(),
  arlName: text("arl_name").notNull(),
  expiresAt: text("expires_at"), // null = never expires
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Custom roles (RBAC templates)
export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  name: text("name").notNull(), // e.g. "Regional Manager", "Area Coach"
  description: text("description"),
  permissions: text("permissions").notNull(), // JSON array of PermissionKey[]
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false), // system-provided template
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Location groups / regions
export const locationGroups = sqliteTable("location_groups", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"), // hex color for UI badge
  parentId: text("parent_id"), // self-referencing for hierarchy
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Location group members - many-to-many
export const locationGroupMembers = sqliteTable("location_group_members", {
  id: text("id").primaryKey(), // UUID
  groupId: text("group_id").notNull().references(() => locationGroups.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Scheduled reports
export const scheduledReports = sqliteTable("scheduled_reports", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'task_completion' | 'leaderboard' | 'attendance' | 'messaging'
  frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'monthly'
  recipients: text("recipients").notNull(), // JSON array of email addresses
  filters: text("filters"), // JSON object with optional filters (locationIds, groupIds, dateRange)
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull(), // ARL id
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Report history
export const reportHistory = sqliteTable("report_history", {
  id: text("id").primaryKey(), // UUID
  reportId: text("report_id").notNull().references(() => scheduledReports.id),
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  status: text("status").notNull().default("pending"), // 'pending' | 'generating' | 'completed' | 'failed'
  filePath: text("file_path"),
  fileContent: blob("file_content"), // PDF bytes
  error: text("error"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

// Organization IP mappings - associate IPs with tenants for kiosk auto-login
export const orgIpMappings = sqliteTable("org_ip_mappings", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  ipAddress: text("ip_address").notNull().unique(),
  createdBy: text("created_by").notNull().references(() => arls.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Meeting participants - detailed per-participant analytics
export const meetingParticipants = sqliteTable("meeting_participants", {
  id: text("id").primaryKey(), // UUID
  meetingId: text("meeting_id").notNull(),
  participantId: text("participant_id").notNull(), // User ID (location/arl/guest)
  participantName: text("participant_name").notNull(),
  participantType: text("participant_type").notNull(), // 'location' | 'arl' | 'guest'
  role: text("role").notNull(), // 'host' | 'cohost' | 'participant'
  joinedAt: text("joined_at").notNull().$defaultFn(() => new Date().toISOString()),
  leftAt: text("left_at"), // null if still in meeting
  duration: integer("duration"), // seconds in meeting
  hadVideo: integer("had_video", { mode: "boolean" }).notNull().default(false),
  hadAudio: integer("had_audio", { mode: "boolean" }).notNull().default(true),
  messagesSent: integer("messages_sent").notNull().default(0),
  questionsSent: integer("questions_sent").notNull().default(0),
  reactionsSent: integer("reactions_sent").notNull().default(0),
  handRaiseCount: integer("hand_raise_count").notNull().default(0),
  wasMutedByHost: integer("was_muted_by_host", { mode: "boolean" }).notNull().default(false),
  connectionQuality: text("connection_quality"), // 'excellent' | 'good' | 'poor'
  deviceType: text("device_type"), // 'desktop' | 'mobile' | 'tablet'
});

// Mood check-ins — anonymous mood ratings per location per day
export const moodCheckins = sqliteTable("mood_checkins", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  date: text("date").notNull(), // YYYY-MM-DD
  moodScore: integer("mood_score").notNull(), // 1-5
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Shift handoffs — structured shift transition records
export const shiftHandoffs = sqliteTable("shift_handoffs", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  shiftDate: text("shift_date").notNull(), // YYYY-MM-DD
  shiftPeriod: text("shift_period").notNull(), // 'morning' | 'afternoon' | 'evening'
  completedTaskCount: integer("completed_task_count").notNull(),
  remainingTaskCount: integer("remaining_task_count").notNull(),
  remainingTaskIds: text("remaining_task_ids"), // JSON array
  arlMessages: text("arl_messages"), // JSON array of { senderName, content, sentAt }
  moodScoreAvg: real("mood_score_avg"),
  handedOffAt: text("handed_off_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Challenges — cross-location competition definitions
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  goalType: text("goal_type").notNull(), // 'consecutive_perfect_days' | 'total_points' | 'completion_rate' | 'fastest_completion'
  targetValue: integer("target_value").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'cancelled'
  createdBy: text("created_by").notNull(), // ARL id
  winnerLocationId: text("winner_location_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Challenge participants — which locations joined which challenges
export const challengeParticipants = sqliteTable("challenge_participants", {
  id: text("id").primaryKey(), // UUID
  challengeId: text("challenge_id").notNull().references(() => challenges.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  joinedAt: text("joined_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Challenge progress — daily progress tracking per location per challenge
export const challengeProgress = sqliteTable("challenge_progress", {
  id: text("id").primaryKey(), // UUID
  challengeId: text("challenge_id").notNull().references(() => challenges.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  date: text("date").notNull(), // YYYY-MM-DD
  progressValue: integer("progress_value").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Mentorship pairs — mentor/mentee location pairings
export const mentorshipPairs = sqliteTable("mentorship_pairs", {
  id: text("id").primaryKey(), // UUID
  tenantId: text("tenant_id").notNull().default("kazi").references(() => tenants.id),
  mentorLocationId: text("mentor_location_id").notNull().references(() => locations.id),
  menteeLocationId: text("mentee_location_id").notNull().references(() => locations.id),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'dissolved'
  createdBy: text("created_by").notNull(), // ARL id
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  endedAt: text("ended_at"),
});
