CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reference_images` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`floor_id` text NOT NULL,
	`module` text NOT NULL,
	`name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`file_key` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `renders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`floor_id` text NOT NULL,
	`module` text NOT NULL,
	`status` text NOT NULL,
	`prompt` text NOT NULL,
	`file_key` text,
	`error` text,
	`created_at` text NOT NULL,
	`state_revision` integer DEFAULT 0 NOT NULL
);
