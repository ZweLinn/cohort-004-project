CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer NOT NULL,
	`user_id` integer,
	`parent_id` integer,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`deleted_at` text,
	`deleted_by_user_id` integer,
	`deleted_reason` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_lesson_parent_created_idx` ON `comments` (`lesson_id`,`parent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_user_created_idx` ON `comments` (`user_id`,`created_at`);