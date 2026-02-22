CREATE TABLE `broadcast_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`broadcast_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broadcast_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`broadcast_id` text NOT NULL,
	`asker_type` text NOT NULL,
	`asker_id` text NOT NULL,
	`asker_name` text NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`answered_at` text,
	`is_answered` integer DEFAULT false NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broadcast_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`broadcast_id` text NOT NULL,
	`viewer_type` text NOT NULL,
	`viewer_id` text NOT NULL,
	`viewer_name` text NOT NULL,
	`emoji` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broadcast_viewers` (
	`id` text PRIMARY KEY NOT NULL,
	`broadcast_id` text NOT NULL,
	`viewer_type` text NOT NULL,
	`viewer_id` text NOT NULL,
	`viewer_name` text NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	`watch_duration` integer,
	`is_minimized` integer DEFAULT false NOT NULL,
	`is_dismissed` integer DEFAULT false NOT NULL,
	`completion_rate` real
);
--> statement-breakpoint
CREATE TABLE `broadcasts` (
	`id` text PRIMARY KEY NOT NULL,
	`arl_id` text NOT NULL,
	`arl_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'live' NOT NULL,
	`stream_mode` text DEFAULT 'video' NOT NULL,
	`target_audience` text DEFAULT 'all' NOT NULL,
	`target_location_ids` text,
	`recording_url` text,
	`thumbnail_url` text,
	`viewer_count` integer DEFAULT 0 NOT NULL,
	`total_views` integer DEFAULT 0 NOT NULL,
	`reaction_count` integer DEFAULT 0 NOT NULL,
	`scheduled_for` text,
	`started_at` text,
	`ended_at` text,
	`duration` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_type` text NOT NULL,
	`user_name` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
DROP TABLE `mrd_print_logs`;--> statement-breakpoint
DROP TABLE `mrd_products`;--> statement-breakpoint
ALTER TABLE `sessions` ADD `current_page` text;