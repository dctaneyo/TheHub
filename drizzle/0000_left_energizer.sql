CREATE TABLE `arls` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`user_id` text NOT NULL,
	`pin_hash` text NOT NULL,
	`role` text DEFAULT 'arl' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arls_user_id_unique` ON `arls` (`user_id`);--> statement-breakpoint
CREATE TABLE `conversation_members` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`member_id` text NOT NULL,
	`member_type` text NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'direct' NOT NULL,
	`name` text,
	`participant_a_id` text,
	`participant_a_type` text,
	`participant_b_id` text,
	`participant_b_type` text,
	`last_message_at` text,
	`last_message_preview` text,
	`created_by` text,
	`deleted_by` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emergency_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`sent_by` text NOT NULL,
	`sent_by_name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`target_location_ids` text,
	`viewed_by` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_content` blob,
	`file_size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `location_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`date` text NOT NULL,
	`points_earned` integer DEFAULT 0 NOT NULL,
	`tasks_completed` integer DEFAULT 0 NOT NULL,
	`tasks_missed` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`store_number` text NOT NULL,
	`address` text,
	`email` text,
	`user_id` text NOT NULL,
	`pin_hash` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sound_muted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_store_number_unique` ON `locations` (`store_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_user_id_unique` ON `locations` (`user_id`);--> statement-breakpoint
CREATE TABLE `message_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`reader_type` text NOT NULL,
	`reader_id` text NOT NULL,
	`read_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mrd_print_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`location_id` text NOT NULL,
	`made_at` text NOT NULL,
	`printed_at` text NOT NULL,
	`ready_at` text NOT NULL,
	`discard_at` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`printer_info` text
);
--> statement-breakpoint
CREATE TABLE `mrd_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ready_time_type` text DEFAULT 'specific' NOT NULL,
	`ready_time_value` text,
	`discard_offset_minutes` integer DEFAULT 120 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`reference_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`is_dismissed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_user_type` text,
	`assigned_user_id` text,
	`activated_by` text,
	`token` text,
	`redirect_to` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	`activated_at` text,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_sessions_code_unique` ON `pending_sessions` (`code`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_code` text,
	`user_type` text NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`socket_id` text,
	`is_online` integer DEFAULT false NOT NULL,
	`last_seen` text NOT NULL,
	`device_type` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`location_id` text NOT NULL,
	`completed_at` text NOT NULL,
	`completed_date` text NOT NULL,
	`notes` text,
	`points_earned` integer DEFAULT 0 NOT NULL,
	`bonus_points` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'task' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_time` text NOT NULL,
	`due_date` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_type` text,
	`recurring_days` text,
	`biweekly_start` text,
	`location_id` text,
	`created_by` text NOT NULL,
	`created_by_type` text DEFAULT 'arl' NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`allow_early_complete` integer DEFAULT false NOT NULL,
	`show_in_today` integer DEFAULT true NOT NULL,
	`show_in_7day` integer DEFAULT true NOT NULL,
	`show_in_calendar` integer DEFAULT true NOT NULL,
	`points` integer DEFAULT 10 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
