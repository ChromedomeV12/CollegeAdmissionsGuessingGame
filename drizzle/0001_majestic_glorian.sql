PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game_attempts` (
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
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "game_attempts_state_check" CHECK("__new_game_attempts"."state" IN ('guessing','retry_pending','retrying','finalized'))
);
--> statement-breakpoint
INSERT INTO `__new_game_attempts`("id", "user_id", "profile_id", "state", "started_at", "retry_deadline", "recovery_deadline", "retry_started_at", "first_result", "first_prediction", "finalized_result", "finalized_at") SELECT "id", "user_id", "profile_id", "state", "started_at", "retry_deadline", "recovery_deadline", "retry_started_at", "first_result", "first_prediction", "finalized_result", "finalized_at" FROM `game_attempts`;--> statement-breakpoint
DROP TABLE `game_attempts`;--> statement-breakpoint
ALTER TABLE `__new_game_attempts` RENAME TO `game_attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_attempts_active_profile` ON `game_attempts` (`user_id`,`profile_id`) WHERE "game_attempts"."state" <> 'finalized';--> statement-breakpoint
CREATE INDEX `idx_game_attempts_user_profile` ON `game_attempts` (`user_id`,`profile_id`);