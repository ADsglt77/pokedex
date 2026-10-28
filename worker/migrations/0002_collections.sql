CREATE TABLE `collections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`collection` text NOT NULL,
	`shopping` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
