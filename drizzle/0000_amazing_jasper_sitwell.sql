CREATE TABLE `scouting_records` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`match_number` text NOT NULL,
	`team` text NOT NULL,
	`scout` text,
	`alliance` text,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_event` ON `scouting_records` (`event`);--> statement-breakpoint
CREATE INDEX `idx_records_team` ON `scouting_records` (`team`);--> statement-breakpoint
CREATE INDEX `idx_records_updated` ON `scouting_records` (`updated_at`);