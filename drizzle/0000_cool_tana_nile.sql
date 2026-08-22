CREATE TABLE `game_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`state` text NOT NULL,
	`started_at` text NOT NULL,
	`retry_deadline` text,
	`recovery_deadline` text,
	`retry_started_at` text,
	`first_result` text,
	`first_prediction` text,
	`finalized_result` text,
	`finalized_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_attempts_active_profile` ON `game_attempts` (`user_id`,`profile_id`) WHERE "game_attempts"."state" <> 'finalized';--> statement-breakpoint
CREATE INDEX `idx_game_attempts_user_profile` ON `game_attempts` (`user_id`,`profile_id`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_locks` (
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`locked_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `profile_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer NOT NULL,
	`public_json` text NOT NULL,
	`full_json` text NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_sort_order` ON `profiles` (`sort_order`);--> statement-breakpoint
CREATE TABLE `rivals` (
	`user_id` text NOT NULL,
	`rival_user_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `rival_user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rival_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`score` integer NOT NULL,
	`breakdown` text,
	PRIMARY KEY(`user_id`, `profile_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);