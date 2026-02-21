ALTER TABLE `mrd_products` ADD `ready_time_days_offset` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `mrd_products` ADD `discard_time_type` text DEFAULT 'offset' NOT NULL;--> statement-breakpoint
ALTER TABLE `mrd_products` ADD `discard_offset_hours` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `mrd_products` ADD `discard_offset_days` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `mrd_products` ADD `discard_time_days_offset` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `mrd_products` DROP COLUMN `discard_offset_minutes`;